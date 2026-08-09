package com.lth.ecommerceagent.simulation;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lth.ecommerceagent.inventory.Inventory;
import com.lth.ecommerceagent.inventory.InventoryRepository;
import com.lth.ecommerceagent.operation.OperationPlan;
import com.lth.ecommerceagent.operation.OperationPlanRepository;
import com.lth.ecommerceagent.order.Order;
import com.lth.ecommerceagent.order.OrderRepository;
import com.lth.ecommerceagent.platform.OrderPullCommand;
import com.lth.ecommerceagent.platform.OrderSource;
import com.lth.ecommerceagent.platform.PlanTarget;
import com.lth.ecommerceagent.platform.PulledOrder;
import com.lth.ecommerceagent.product.Product;
import com.lth.ecommerceagent.product.ProductRepository;
import com.lth.ecommerceagent.python.PythonAgentClient;
import com.lth.ecommerceagent.python.PythonAgentException;
import com.lth.ecommerceagent.python.PythonPlatformStatus;
import com.lth.ecommerceagent.sales.DailySales;
import com.lth.ecommerceagent.sales.DailySalesRepository;

/**
 * 模拟从电商平台 API 拉取订单，并全链路联动写入：
 * - orders（逐单生成）
 * - inventories（按累计销量扣减 current_stock + 重算 inventory_status）
 * - daily_sales（按 商品+日期 聚合 upsert，供销售监控趋势曲线）
 *
 * <p>订单从哪来（本地模拟 / 真实平台）由 {@link OrderSource} 抽象收敛：
 * 两种来源只产出<b>事实</b>（是否已付款、地址是否完整、是否需人工复核等），
 * 业务状态由本类的 {@link #deriveStatus} 按同一套规则统一推导，因此 mock 与 real 切换时
 * 库表结构、Agent 逻辑、前端页面都不需要改——用户只需在设置中心填好平台凭证、把
 * {@code DATA_SOURCE} 切到 real，系统即按"真的拉过单"的方式运转。
 *
 * <p>时间分布：回填过去 days 天（含今天），每天每商品随机 1..maxOrdersPerDay 单（真实来源不限）。
 */
@Service
public class SimulationService {

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final InventoryRepository inventoryRepository;
    private final DailySalesRepository dailySalesRepository;
    private final OperationPlanRepository operationPlanRepository;
    private final PythonAgentClient pythonAgentClient;
    private final List<OrderSource> orderSources;

    /** 订单数据来源：mock=本地模拟造数（默认）；real=平台开放 API 拉取。 */
    @Value("${platform.data-source:mock}")
    private String dataSource;

    public SimulationService(
            OrderRepository orderRepository,
            ProductRepository productRepository,
            InventoryRepository inventoryRepository,
            DailySalesRepository dailySalesRepository,
            OperationPlanRepository operationPlanRepository,
            PythonAgentClient pythonAgentClient,
            List<OrderSource> orderSources) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.inventoryRepository = inventoryRepository;
        this.dailySalesRepository = dailySalesRepository;
        this.operationPlanRepository = operationPlanRepository;
        this.pythonAgentClient = pythonAgentClient;
        this.orderSources = orderSources;
    }

    @Transactional
    public SimulationResult pullOrders(SimulationRequest req) {
        int days = (req.days() != null && req.days() > 0) ? req.days() : 14;
        int maxOrdersPerDay = (req.maxOrdersPerDay() != null && req.maxOrdersPerDay() > 0) ? req.maxOrdersPerDay() : 5;
        int maxQty = (req.maxQty() != null && req.maxQty() > 0) ? req.maxQty() : 3;

        // 拉单对象：已确认(CONFIRMED)的运营计划（计划才代表商品已真正在某平台上架）。
        List<OperationPlan> plans;
        List<Long> planIds = req.planIds();
        if (planIds != null && !planIds.isEmpty()) {
            plans = planIds.stream()
                    .map(operationPlanRepository::findById)
                    .filter(Optional::isPresent)
                    .map(Optional::get)
                    .filter(p -> "CONFIRMED".equals(p.getConfirmationStatus()))
                    .collect(Collectors.toList());
        } else {
            String platform = (req.platform() != null && !req.platform().isBlank()) ? req.platform() : null;
            plans = (platform != null)
                    ? operationPlanRepository.findByConfirmationStatusAndPlatform("CONFIRMED", platform)
                    : operationPlanRepository.findByConfirmationStatus("CONFIRMED");
        }
        if (plans.isEmpty()) {
            throw new IllegalArgumentException("没有已确认(CONFIRMED)的运营计划可供模拟，请先在新品上架中确认/发布计划");
        }

        // 计划 -> 取单对象 + 商品映射（一个商品可能在多个平台分别发布，平台以计划为准）。
        List<PlanTarget> targets = new ArrayList<>();
        Map<Long, Product> productById = new HashMap<>();
        for (OperationPlan plan : plans) {
            Product product = plan.getProduct();
            if (product == null) {
                continue;
            }
            targets.add(new PlanTarget(
                    plan.getPlatform(),
                    plan.getId(),
                    product.getId(),
                    product.getName(),
                    product.getSalePrice(),
                    null)); // platformItemId 当前运营计划未维护，传 null，由 Python 适配器按名匹配
            productById.put(product.getId(), product);
        }
        if (productById.isEmpty()) {
            throw new IllegalArgumentException("已确认计划未关联有效的商品");
        }

        // 取单：来源只给事实，业务状态/库存决策在本类统一做。
        OrderSource source = resolveSource();
        List<PulledOrder> pulled = source.pull(new OrderPullCommand(targets, days, maxOrdersPerDay, maxQty));

        // 运行库存：按商品从当前库存起逐单扣减，仅当订单量超过剩余库存时才标记「库存不足」，
        // 不再随机打标，避免出现「明明有货却显示库存不足」的误导。
        Map<Long, Integer> remaining = new HashMap<>();
        for (Long pid : productById.keySet()) {
            inventoryRepository.findByProductId(pid)
                    .ifPresent(inv -> remaining.put(pid, inv.getCurrentStock()));
        }

        int ordersCreated = 0;
        // 每商品每平台每日期 汇总：productId -> platform -> (date -> DayAgg)
        Map<Long, Map<String, Map<LocalDate, DayAgg>>> agg = new HashMap<>();
        // 每商品累计已履约销量（跨平台汇总，供库存扣减；库存不足订单不计入）
        Map<Long, Integer> productUnits = new HashMap<>();

        for (PulledOrder po : pulled) {
            Product product = productById.get(po.productId());
            if (product == null) {
                // 真实来源可能带回一个我们这里没确认过的商品，跳过不认识的。
                continue;
            }
            String plat = po.platform();
            int qty = po.quantity();
            int rem = remaining.getOrDefault(po.productId(), 0);
            boolean insufficient = rem <= 0 || qty > rem;
            String status = deriveStatus(po, insufficient);

            // 幂等：真实来源重复同步时，平台单号已存在的订单跳过（不重复落库）。
            if (orderRepository.existsByPlatformAndPlatformOrderId(plat, po.platformOrderId())) {
                continue;
            }

            Order order = toOrder(po, product, status, source.name());
            orderRepository.save(order);
            ordersCreated++;

            if (insufficient) {
                continue; // 未履约：不扣库存、不计入日销与销量汇总
            }
            remaining.put(po.productId(), rem - qty);
            productUnits.merge(po.productId(), qty, Integer::sum);

            LocalDate date = po.orderedOn() != null ? po.orderedOn() : LocalDate.now();
            DayAgg a = agg.computeIfAbsent(po.productId(), k -> new HashMap<>())
                    .computeIfAbsent(plat, k -> new HashMap<>())
                    .computeIfAbsent(date, k -> new DayAgg());
            a.units += qty;
            BigDecimal line = (product.getSalePrice() != null)
                    ? product.getSalePrice().multiply(BigDecimal.valueOf(qty))
                    : BigDecimal.ZERO;
            a.revenue = a.revenue.add(line);
            a.orderCount += 1;
        }

        // 库存联动：按累计销量扣减并据水位重算状态
        int inventoriesUpdated = 0;
        for (Long pid : productUnits.keySet()) {
            Optional<Inventory> invOpt = inventoryRepository.findByProductId(pid);
            if (invOpt.isEmpty()) {
                continue;
            }
            int sold = productUnits.get(pid);
            Inventory inv = invOpt.get();
            int newStock = Math.max(0, inv.getCurrentStock() - sold);
            inv.setCurrentStock(newStock);
            inv.setInventoryStatus(recomputeStatus(newStock, inv.getSafeStockThreshold()));
            inventoryRepository.save(inv);
            inventoriesUpdated++;
        }

        // 日销 upsert（find-then-save 满足唯一约束 product_id + platform + sale_date）
        int dailySalesUpserted = 0;
        for (Long pid : agg.keySet()) {
            for (Map.Entry<String, Map<LocalDate, DayAgg>> pe : agg.get(pid).entrySet()) {
                String plat = pe.getKey();
                for (Map.Entry<LocalDate, DayAgg> e : pe.getValue().entrySet()) {
                    LocalDate date = e.getKey();
                    DayAgg a = e.getValue();
                    Optional<DailySales> existing =
                            dailySalesRepository.findByProductIdAndPlatformAndSaleDate(pid, plat, date);
                    DailySales ds;
                    if (existing.isPresent()) {
                        ds = existing.get();
                        ds.setRevenue(ds.getRevenue().add(a.revenue));
                        ds.setUnits(ds.getUnits() + a.units);
                        ds.setOrderCount(ds.getOrderCount() + a.orderCount);
                    } else {
                        ds = new DailySales();
                        ds.setProductId(pid);
                        ds.setPlatform(plat);
                        ds.setSaleDate(date);
                        ds.setRevenue(a.revenue);
                        ds.setUnits(a.units);
                        ds.setOrderCount(a.orderCount);
                    }
                    dailySalesRepository.save(ds);
                    dailySalesUpserted++;
                }
            }
        }

        return new SimulationResult(ordersCreated, inventoriesUpdated, dailySalesUpserted);
    }

    /** 当前订单数据来源信息（mock/real + 已对接平台列表）。 */
    public DataSourceInfo dataSourceInfo() {
        String source = (dataSource == null || dataSource.isBlank()) ? "mock" : dataSource.trim().toLowerCase();
        List<String> platforms = List.of();
        if ("real".equals(source)) {
            try {
                PythonPlatformStatus status = pythonAgentClient.getPlatformStatus();
                platforms = (status.ready() == null) ? List.of() : status.ready();
            } catch (PythonAgentException e) {
                // 拉不到平台状态不强依赖：页面会提示去设置中心填凭证。
                platforms = List.of();
            }
        }
        return new DataSourceInfo(source, platforms);
    }

    /** 选中当前配置的订单来源（mock / real），找不到来源直接报错。 */
    private OrderSource resolveSource() {
        String name = (dataSource == null || dataSource.isBlank()) ? "mock" : dataSource.trim().toLowerCase();
        return orderSources.stream()
                .filter(s -> s.name().equals(name))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("未找到订单来源: " + name
                        + "（请确认 MockOrderSource / RealOrderSource 已注册）"));
    }

    /**
     * 由订单事实 + 库存情况统一推导业务状态（mock 与 real 共用同一套规则）：
     * - 库存不足 -> INSUFFICIENT_STOCK
     * - 平台标记需人工复核 -> NEEDS_REVIEW
     * - 未付款 或 地址不完整 -> PENDING_ANALYSIS
     * - 其余 -> READY_TO_SHIP（可发货）
     */
    private String deriveStatus(PulledOrder po, boolean insufficient) {
        if (insufficient) {
            return "INSUFFICIENT_STOCK";
        }
        if (po.manualReviewRequired()) {
            return "NEEDS_REVIEW";
        }
        if (!po.paid() || !po.addressComplete()) {
            return "PENDING_ANALYSIS";
        }
        return "READY_TO_SHIP";
    }

    /** PulledOrder(事实) -> Order(落库行)。source 写进 orders.source 区分数据来源。 */
    private Order toOrder(PulledOrder po, Product product, String status, String sourceName) {
        Order order = new Order();
        order.setProduct(product);
        order.setPlatform(po.platform());
        order.setPlatformOrderId(po.platformOrderId());
        order.setSource(sourceName);
        order.setQuantity(po.quantity());
        order.setStatus(status);
        order.setFulfillmentSuggestionStatus(status);
        // 待处理原因仅在待分析态有值：据付款/地址推导，前端据此归类与路由话术。
        order.setPendingReason(Order.computePendingReason(po.paid(), po.addressComplete(), status));
        order.setPaid(po.paid());
        order.setAddressComplete(po.addressComplete());
        order.setManualReviewRequired(po.manualReviewRequired());
        order.setReceiverName(po.receiverName());
        order.setReceiverPhone(po.receiverPhone());
        order.setReceiverProvince(po.receiverProvince());
        order.setReceiverCity(po.receiverCity());
        order.setReceiverDistrict(po.receiverDistrict());
        order.setReceiverDetail(po.receiverDetail());
        order.setBuyerNick(po.buyerNick());
        order.setPayment(po.payment());
        order.setPostFee(po.postFee());
        order.setLogisticsCompany(po.logisticsCompany());
        order.setWaybillNo(po.waybillNo());
        order.setEncrypted(po.encrypted());
        return order;
    }

    private String recomputeStatus(int currentStock, int safeThreshold) {
        if (currentStock < safeThreshold) {
            return "RISK";
        }
        if (currentStock < safeThreshold * 2) {
            return "LOW";
        }
        return "ENOUGH";
    }

    private static final class DayAgg {
        int units = 0;
        int orderCount = 0;
        BigDecimal revenue = BigDecimal.ZERO;
    }
}
