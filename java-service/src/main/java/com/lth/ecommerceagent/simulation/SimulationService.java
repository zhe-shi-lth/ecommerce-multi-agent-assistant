package com.lth.ecommerceagent.simulation;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lth.ecommerceagent.inventory.Inventory;
import com.lth.ecommerceagent.inventory.InventoryRepository;
import com.lth.ecommerceagent.order.Order;
import com.lth.ecommerceagent.order.OrderRepository;
import com.lth.ecommerceagent.product.Product;
import com.lth.ecommerceagent.product.ProductRepository;
import com.lth.ecommerceagent.sales.DailySales;
import com.lth.ecommerceagent.sales.DailySalesRepository;

/**
 * 模拟从电商平台 API 拉取订单，并全链路联动写入：
 * - orders（逐单生成）
 * - inventories（按累计销量扣减 current_stock + 重算 inventory_status）
 * - daily_sales（按 商品+日期 聚合 upsert，供销售监控趋势曲线）
 *
 * 时间分布：回填过去 days 天（含今天），每天每商品随机 1..maxOrdersPerDay 单。
 */
@Service
public class SimulationService {

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final InventoryRepository inventoryRepository;
    private final DailySalesRepository dailySalesRepository;
    private final Random random = new Random();

    public SimulationService(
            OrderRepository orderRepository,
            ProductRepository productRepository,
            InventoryRepository inventoryRepository,
            DailySalesRepository dailySalesRepository) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.inventoryRepository = inventoryRepository;
        this.dailySalesRepository = dailySalesRepository;
    }

    @Transactional
    public SimulationResult pullOrders(SimulationRequest req) {
        List<Long> productIds = req.productIds();
        if (productIds == null || productIds.isEmpty()) {
            throw new IllegalArgumentException("productIds 不能为空");
        }
        int days = (req.days() != null && req.days() > 0) ? req.days() : 14;
        int maxOrdersPerDay = (req.maxOrdersPerDay() != null && req.maxOrdersPerDay() > 0) ? req.maxOrdersPerDay() : 5;
        int maxQty = (req.maxQty() != null && req.maxQty() > 0) ? req.maxQty() : 3;
        // 本次拉取统一归属到所选平台（模拟器单选平台；缺省 taobao）
        String platform = (req.platform() != null && !req.platform().isBlank()) ? req.platform() : "taobao";

        Map<Long, Product> products = productIds.stream()
                .map(productRepository::findById)
                .filter(Optional::isPresent)
                .map(Optional::get)
                .collect(Collectors.toMap(Product::getId, p -> p));
        if (products.isEmpty()) {
            throw new IllegalArgumentException("未找到有效的商品");
        }

        int ordersCreated = 0;
        // 每商品每平台每日期 汇总：productId -> platform -> (date -> DayAgg)
        Map<Long, Map<String, Map<LocalDate, DayAgg>>> agg = new HashMap<>();
        // 每商品累计销量（跨平台汇总，供库存扣减）
        Map<Long, Integer> productUnits = new HashMap<>();

        LocalDate today = LocalDate.now();
        for (int d = days - 1; d >= 0; d--) {
            LocalDate date = today.minusDays(d);
            for (Long pid : products.keySet()) {
                Product product = products.get(pid);
                int n = 1 + random.nextInt(maxOrdersPerDay);
                for (int i = 0; i < n; i++) {
                    int qty = 1 + random.nextInt(maxQty);
                    orderRepository.save(buildOrder(product, qty, platform));
                    ordersCreated++;
                    DayAgg a = agg.computeIfAbsent(pid, k -> new HashMap<>())
                            .computeIfAbsent(platform, k -> new HashMap<>())
                            .computeIfAbsent(date, k -> new DayAgg());
                    a.units += qty;
                    BigDecimal line = (product.getSalePrice() != null)
                            ? product.getSalePrice().multiply(BigDecimal.valueOf(qty))
                            : BigDecimal.ZERO;
                    a.revenue = a.revenue.add(line);
                    a.orderCount += 1;
                    productUnits.merge(pid, qty, Integer::sum);
                }
            }
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

    private Order buildOrder(Product product, int qty, String platform) {
        Order order = new Order();
        order.setProduct(product);
        order.setPlatform(platform);
        order.setQuantity(qty);
        double r = random.nextDouble();
        String status;
        boolean paid;
        boolean addressComplete;
        boolean manualReview;
        if (r < 0.70) {
            status = "READY_TO_SHIP";
            paid = true;
            addressComplete = true;
            manualReview = false;
        } else if (r < 0.85) {
            status = "PENDING_ANALYSIS";
            paid = false;
            addressComplete = random.nextBoolean();
            manualReview = false;
        } else if (r < 0.95) {
            status = "NEEDS_REVIEW";
            paid = random.nextBoolean();
            addressComplete = random.nextBoolean();
            manualReview = true;
        } else {
            status = "INSUFFICIENT_STOCK";
            paid = true;
            addressComplete = true;
            manualReview = false;
        }
        order.setStatus(status);
        order.setPaid(paid);
        order.setAddressComplete(addressComplete);
        order.setManualReviewRequired(manualReview);
        order.setFulfillmentSuggestionStatus(status);
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
