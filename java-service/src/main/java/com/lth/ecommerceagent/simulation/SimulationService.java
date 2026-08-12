package com.lth.ecommerceagent.simulation;

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
import com.lth.ecommerceagent.order.OrderCompletionService;
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

/**
 * 模拟从电商平台 API 拉取订单，并全链路联动写入：
 * - orders（逐单生成）
 * 同步阶段只落订单事实。仅事实完整的订单尝试预留库存；销量在发货成功时统计。
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
    private final OrderCompletionService orderCompletionService;
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
            OrderCompletionService orderCompletionService,
            OperationPlanRepository operationPlanRepository,
            PythonAgentClient pythonAgentClient,
            List<OrderSource> orderSources) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.inventoryRepository = inventoryRepository;
        this.orderCompletionService = orderCompletionService;
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

        int ordersCreated = 0;

        for (PulledOrder po : pulled) {
            Product product = productById.get(po.productId());
            if (product == null) {
                // 真实来源可能带回一个我们这里没确认过的商品，跳过不认识的。
                continue;
            }
            String plat = po.platform();
            String status = deriveStatus(po, false);

            // 幂等：真实来源重复同步时，平台单号已存在的订单跳过（不重复落库）。
            if (orderRepository.existsByPlatformAndPlatformOrderId(plat, po.platformOrderId())) {
                continue;
            }

            Order order = orderRepository.save(toOrder(po, product, status, source.name()));
            ordersCreated++;
            if ("READY_TO_SHIP".equals(status)) {
                try {
                    orderCompletionService.reserveImportedOrder(order);
                } catch (org.springframework.web.server.ResponseStatusException e) {
                    // 同步不能因单笔缺货整体失败；该订单被服务收敛为库存不足。
                }
            }
        }
        return new SimulationResult(ordersCreated, 0, 0);
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

}
