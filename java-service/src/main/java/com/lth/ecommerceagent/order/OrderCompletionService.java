package com.lth.ecommerceagent.order;

import java.util.List;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.lth.ecommerceagent.inventory.Inventory;
import com.lth.ecommerceagent.inventory.InventoryRepository;
import com.lth.ecommerceagent.inventory.InventoryMovementService;
import com.lth.ecommerceagent.audit.BusinessAuditService;
import com.lth.ecommerceagent.python.PythonAgentClient;
import com.lth.ecommerceagent.python.PythonAgentException;
import com.lth.ecommerceagent.python.PythonFulfillmentResult;
import com.lth.ecommerceagent.python.PythonOrderFulfillmentRequest;
import com.lth.ecommerceagent.python.PythonShipRequest;
import com.lth.ecommerceagent.python.PythonShipResult;
import com.lth.ecommerceagent.sales.SalesRecordingService;
import com.lth.ecommerceagent.platformtask.PlatformTask;
import com.lth.ecommerceagent.platformtask.PlatformTaskService;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * 地址补全的落库与履约状态推导（单一真相源）。
 *
 * <p>手动「确认地址已补全」与定时轮询（自动回写平台真相）都走这里：置 addressComplete=true
 * → 调 Python 履约 Agent 重算 → 把结论收敛为合法枚举并同时写 orders.status 与
 * fulfillment_suggestion_status（canShip→READY_TO_SHIP；仍缺库存→INSUFFICIENT_STOCK；其余→NEEDS_REVIEW）。
 */
@Service
public class OrderCompletionService {

    private final OrderRepository orderRepository;
    private final InventoryRepository inventoryRepository;
    private final PythonAgentClient pythonAgentClient;
    private final BusinessAuditService auditService;
    private final InventoryMovementService movementService;
    private final SalesRecordingService salesRecordingService;
    private final PlatformTaskService platformTaskService;
    private final ObjectMapper objectMapper;

    public OrderCompletionService(
            OrderRepository orderRepository,
            InventoryRepository inventoryRepository,
            PythonAgentClient pythonAgentClient,
            BusinessAuditService auditService,
            InventoryMovementService movementService,
            SalesRecordingService salesRecordingService,
            PlatformTaskService platformTaskService,
            ObjectMapper objectMapper) {
        this.orderRepository = orderRepository;
        this.inventoryRepository = inventoryRepository;
        this.pythonAgentClient = pythonAgentClient;
        this.auditService = auditService;
        this.movementService = movementService;
        this.salesRecordingService = salesRecordingService;
        this.platformTaskService = platformTaskService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public Order markAddressComplete(Order order) {
        order = lockOrder(order.getId());
        String before = order.getStatus();
        order.setAddressComplete(true);
        resolveFulfillment(order);
        reserveStockIfReady(order);
        Order saved = orderRepository.save(order);
        auditService.record("ORDER", "ORDER", saved.getId(), "COMPLETE_ADDRESS",
                before, saved.getStatus(), "收货地址已确认完整");
        return saved;
    }

    /**
     * 标记已付款并流转状态（对称 markAddressComplete），单一真相源。
     *
     * <p>手动「确认已付款」与定时轮询（自动回写平台付款真相）都走这里：置 paid=true
     * → 按「事实」重新判定 → 把结论收敛为合法枚举并同时写 orders.status 与
     * fulfillment_suggestion_status（canShip→READY_TO_SHIP；仍缺库存→INSUFFICIENT_STOCK；其余→NEEDS_REVIEW）。
     */
    @Transactional
    public Order markPaid(Order order) {
        order = lockOrder(order.getId());
        String before = order.getStatus();
        order.setPaid(true);
        resolveFulfillment(order);
        reserveStockIfReady(order);
        Order saved = orderRepository.save(order);
        auditService.record("ORDER", "ORDER", saved.getId(), "MARK_PAID",
                before, saved.getStatus(), "付款状态已确认");
        return saved;
    }

    @Transactional
    public Order escalateOverdue(Long orderId, int slaDays) {
        Order order = lockOrder(orderId);
        if (!"PENDING_ANALYSIS".equals(order.getStatus())
                || (Boolean.TRUE.equals(order.getPaid()) && Boolean.TRUE.equals(order.getAddressComplete()))) {
            return order;
        }
        String before = order.getStatus();
        order.setStatus("NEEDS_REVIEW");
        order.setFulfillmentSuggestionStatus("NEEDS_REVIEW");
        order.setManualReviewRequired(true);
        order.setPendingReason(Order.computePendingReason(order.getPaid(), order.getAddressComplete(), "PENDING_ANALYSIS"));
        Order saved = orderRepository.save(order);
        auditService.record("ORDER", "ORDER", saved.getId(), "ESCALATE_OVERDUE",
                before, saved.getStatus(), "待处理超过 " + slaDays + " 天，已升级人工审核");
        return saved;
    }

    /** 平台拉单后对已满足全部事实的订单执行同一套原子预留。 */
    @Transactional
    public Order reserveImportedOrder(Order order) {
        if (!"READY_TO_SHIP".equals(order.getStatus())) return order;
        reserveStockIfReady(order);
        return orderRepository.save(order);
    }

    /**
     * 库存补足后的「重新判定」（单订单）：商家在订单详情点「我已补货，重新判定」触发。
     * <b>不走 Python 履约 Agent</b>——补货后结论可由「事实 + 库存」直接判定，既能秒回也避免逐个订单发起慢调用卡死前端。
     * 库存仍不足（{@code currentStock < quantity}）直接 409 拒绝并提示缺口，不做静默翻转；
     * 库存充足且付款/地址齐全则翻回 READY_TO_SHIP；否则回到待分析/审核。
     */
    @Transactional
    public Order recheckStock(Order order) {
        order = lockOrder(order.getId());
        Long productId = order.getProduct().getId();
        Inventory inventory = inventoryRepository.findByProductId(productId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Inventory not found for product: " + productId));
        int available = inventory.getCurrentStock() - inventory.getReservedStock();
        if (available < order.getQuantity()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "库存仍不足（可售 " + available + " < 订单 " + order.getQuantity()
                            + "），请先补足库存再重新判定");
        }
        // 补货后「重新判定」= 真去库存拿货：订单翻成可发货的同时把对应货量从库存扣掉，账目才闭环。
        // 仅当本单确能履约（付款/地址齐全且无人工审核，落为 READY_TO_SHIP）才扣减；
        // 其余回落态（待分析/审核）并不占用库存，绝不静默扣减。
        resolveRecheck(order, true);
        if (!"READY_TO_SHIP".equals(order.getStatus())) {
            Order saved = orderRepository.save(order);
            auditService.record("ORDER", "ORDER", saved.getId(), "RECHECK_STOCK",
                    "INSUFFICIENT_STOCK", saved.getStatus(), "库存重判完成，订单尚不可发货");
            return saved;
        }
        if (!reserve(order)) {
            resolveRecheck(order, false);
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "库存不足或库存已被其他订单占用，请补足库存后再重新判定");
        }
        Order saved = orderRepository.save(order);
        auditService.record("ORDER", "ORDER", saved.getId(), "RECHECK_STOCK",
                "INSUFFICIENT_STOCK", saved.getStatus(), "库存已原子预留，订单转为可发货");
        return saved;
    }

    /**
     * 批量「重新判定」所有库存不足订单（订单 tab「缺货订单状态刷新」按钮）：<b>补货完成后</b>，按当前库存重算这些订单的状态。
     * 翻成可发货的订单会<b>真实从库存拿货</b>（扣减对应货量并重算库存水位），与单订单刷新同一套账目逻辑；补货本身仍由既有补货闭环负责。
     * 按商品分组、组内按下单时间从早到晚分配可用库存：越早的优先占用，能凑齐翻回 READY_TO_SHIP，凑不齐的保持挂起
     * （及未付款/地址不全/需审核的回落对应态）。全程不调 Python，快且不卡前端；统计三类结果供前端提示。
     */
    @Transactional
    public RecheckAllResult recheckAllInsufficient() {
        List<Order> orders = orderRepository.findByStatus("INSUFFICIENT_STOCK");
        RecheckAllResult result = new RecheckAllResult(orders.size(), 0, 0, 0);
        java.util.Map<Long, List<Order>> byProduct = new java.util.LinkedHashMap<>();
        for (Order o : orders) {
            byProduct.computeIfAbsent(o.getProduct().getId(), k -> new java.util.ArrayList<>()).add(o);
        }
        for (java.util.Map.Entry<Long, List<Order>> e : byProduct.entrySet()) {
            rejudgeGroup(e.getKey(), e.getValue(), result);
        }
        return result;
    }

    /**
     * 单商品「重新判定」（销售监控「对应位置」按钮）：补货完成后，重算该商品库存不足订单的状态；翻成可发货的订单真实扣减库存。
     */
    @Transactional
    public RecheckAllResult recheckProduct(Long productId) {
        List<Order> group = orderRepository.findByStatusAndProductId("INSUFFICIENT_STOCK", productId);
        RecheckAllResult result = new RecheckAllResult(group.size(), 0, 0, 0);
        rejudgeGroup(productId, group, result);
        return result;
    }

    /**
     * 组内按下单时间升序，越早的订单优先占用可用库存；能凑齐→READY_TO_SHIP（占用并扣减库存），否则保持/回落，统计写入 result。
     * 与单订单「重新判定」一致：翻成可发货的订单真实从 inventory.current_stock 拿货，循环结束后把剩余库存与水位状态落库。
     */
    private void rejudgeGroup(Long productId, List<Order> group, RecheckAllResult result) {
        Inventory inventory = inventoryRepository.findByProductId(productId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Inventory not found for product: " + productId));
        int avail = inventory.getCurrentStock() - inventory.getReservedStock();
        group.sort((a, b) -> {
            int c = a.getCreatedAt().compareTo(b.getCreatedAt());
            return c != 0 ? c : Long.compare(a.getId(), b.getId());
        });
        for (Order o : group) {
            // 仅当「无人工审核 ∧ 已付款 ∧ 地址完整 ∧ 库存够」才可履约并占用库存；否则不占用（回落对应态）。
            boolean canFulfill = Boolean.FALSE.equals(o.getManualReviewRequired())
                    && Boolean.TRUE.equals(o.getPaid())
                    && Boolean.TRUE.equals(o.getAddressComplete())
                    && avail >= o.getQuantity();
            boolean reserved = canFulfill && reserve(o);
            if (reserved) {
                avail -= o.getQuantity();
            }
            resolveRecheck(o, reserved);
            String after = o.getStatus();
            if ("READY_TO_SHIP".equals(after)) {
                result.incrementReady();
            } else if ("INSUFFICIENT_STOCK".equals(after)) {
                result.incrementStillShort();
            } else {
                result.incrementOther();
            }
            orderRepository.save(o);
            if (!"INSUFFICIENT_STOCK".equals(after)) {
                auditService.record("ORDER", "ORDER", o.getId(), "AUTO_RECHECK_STOCK",
                        "INSUFFICIENT_STOCK", after,
                        reserved ? "库存已自动预留" : "订单条件变化，重新归类");
            }
        }
        // 库存联动：本次刷新实际占用的货（仅翻成 READY_TO_SHIP 的订单）从库存扣减，并据水位重算库存状态。
        // 每笔可发货订单已通过条件 UPDATE 原子扣减库存，这里不再用旧快照覆盖数据库。
    }

    /** 据当前库存与警戒水位重算库存状态（RISK/LOW/ENOUGH），与 SimulationService 同口径，避免规则分叉。 */
    private String recomputeStatus(int currentStock, int safeThreshold) {
        if (currentStock < safeThreshold) {
            return "RISK";
        }
        if (currentStock < safeThreshold * 2) {
            return "LOW";
        }
        return "ENOUGH";
    }

    /**
     * 重判定的确定性结论（不调 Python）：人工审核优先 → 未付款/地址不全 → 库存是否可履约。
     * stockOk=true 且付款/地址齐全且无人工审核 → READY_TO_SHIP；stockOk=false 且付款/地址齐全 → 保持 INSUFFICIENT_STOCK；
     * 其余回落 NEEDS_REVIEW / PENDING_ANALYSIS。
     */
    private void resolveRecheck(Order order, boolean stockOk) {
        if (Boolean.TRUE.equals(order.getManualReviewRequired())) {
            order.setPendingReason(null);
            order.setStatus("NEEDS_REVIEW");
            order.setFulfillmentSuggestionStatus("NEEDS_REVIEW");
            return;
        }
        if (Boolean.FALSE.equals(order.getPaid())) {
            order.setPendingReason(Order.computePendingReason(false, order.getAddressComplete(), "PENDING_ANALYSIS"));
            order.setStatus("PENDING_ANALYSIS");
            order.setFulfillmentSuggestionStatus("PENDING_ANALYSIS");
            return;
        }
        if (Boolean.FALSE.equals(order.getAddressComplete())) {
            order.setPendingReason(Order.computePendingReason(order.getPaid(), false, "PENDING_ANALYSIS"));
            order.setStatus("PENDING_ANALYSIS");
            order.setFulfillmentSuggestionStatus("PENDING_ANALYSIS");
            return;
        }
        // 已付款 + 地址完整：看库存是否可履约。
        order.setPendingReason(null);
        if (stockOk) {
            order.setStatus("READY_TO_SHIP");
            order.setFulfillmentSuggestionStatus("READY_TO_SHIP");
        } else {
            order.setStatus("INSUFFICIENT_STOCK");
            order.setFulfillmentSuggestionStatus("INSUFFICIENT_STOCK");
        }
    }

    /**
     * 按订单「事实」统一重算履约状态（人工审核优先 → 未付款/地址不全 → 履约 Agent 计算）。
     * 调用前需先把已发生的事实（addressComplete / paid / manualReviewRequired）写到 order 上，
     * markAddressComplete / markPaid / recheckStock 都复用此单一真相源，避免规则分叉。
     */
    private void resolveFulfillment(Order order) {
        if (Boolean.TRUE.equals(order.getManualReviewRequired())) {
            order.setPendingReason(null);
            order.setStatus("NEEDS_REVIEW");
            order.setFulfillmentSuggestionStatus("NEEDS_REVIEW");
            return;
        }
        if (Boolean.FALSE.equals(order.getPaid())) {
            order.setPendingReason(Order.computePendingReason(false, order.getAddressComplete(), "PENDING_ANALYSIS"));
            order.setStatus("PENDING_ANALYSIS");
            order.setFulfillmentSuggestionStatus("PENDING_ANALYSIS");
            return;
        }
        if (Boolean.FALSE.equals(order.getAddressComplete())) {
            order.setPendingReason(Order.computePendingReason(order.getPaid(), false, "PENDING_ANALYSIS"));
            order.setStatus("PENDING_ANALYSIS");
            order.setFulfillmentSuggestionStatus("PENDING_ANALYSIS");
            return;
        }

        // 已付款 + 地址完整 → 调履约 Agent 重算能否发货。
        order.setPendingReason(null);

        Inventory inventory = inventoryRepository.findByProductId(order.getProduct().getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Inventory not found for product: " + order.getProduct().getId()));

        PythonOrderFulfillmentRequest request = PythonOrderFulfillmentRequest.from(order, inventory);
        PythonFulfillmentResult result = pythonAgentClient.callOrderFulfillment(request);

        // Python 的 next_order_status 可能由 LLM 生成，不保证落在 orders 表的 CHECK 枚举内；
        // 这里收敛为合法枚举后再落库，避免违反 ck_orders_* 的 CHECK 约束。
        String resolved = toSuggestionStatus(result, order);
        order.setFulfillmentSuggestionStatus(resolved);
        order.setStatus(resolved);
        order.setFulfillmentPlanJson(result.toJsonMap());
    }

    private String toSuggestionStatus(PythonFulfillmentResult result, Order order) {
        if (Boolean.TRUE.equals(result.canShip())) {
            return "READY_TO_SHIP";
        }
        // 仍缺库存时保留库存不足态，其余统一转人工审核。
        if ("INSUFFICIENT_STOCK".equals(order.getStatus())) {
            return "INSUFFICIENT_STOCK";
        }
        return "NEEDS_REVIEW";
    }

    /**
     * 发货闭环：商家在订单详情「发货」→ 回写平台发货 API → 成功置 SHIPPED、失败置 SHIPPING_FAILED。
     * 仅「可发货(READY_TO_SHIP)」或「发货失败(SHIPPING_FAILED，可重试)」可发起：
     * - 调 Python PlatformAdapter.ship_order（模拟器模式返回同构受理回执；真实模式调官方发货 API）；
     * - 平台受理成功 → 写回物流公司/运单号/发货时间，状态 SHIPPED；
     * - 平台拒绝或调用异常 → 状态 SHIPPING_FAILED + pendingReason 记录失败原因，不发货、不扣减，可重试。
     * 物流公司/运单号缺失时由本方法兜底生成（与模拟器同构），保证回写平台的最小字段齐全。
     */
    @Transactional
    public Order ship(Order order, ShipRequest request) {
        order = lockOrder(order.getId());
        if ("SHIPPED".equals(order.getStatus())) {
            return order;
        }
        if (!"READY_TO_SHIP".equals(order.getStatus()) && !"SHIPPING_FAILED".equals(order.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "仅「可发货 / 发货失败」订单可以发货，当前状态：" + order.getStatus());
        }
        Long productId = order.getProduct().getId();
        String before = order.getStatus();
        // 发货运费校验：必填（包邮填 0，避免利润出现空值）；不能为负；来源类型仅允许 MANUAL / TEMPLATE。
        // 否则 API 直调可传异常值，或留下「类型为 MANUAL 但金额为空」的歧义数据。
        if (request.shippingFee() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "发货运费必填（包邮请填 0）");
        }
        if (request.shippingFee().compareTo(java.math.BigDecimal.ZERO) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "发货运费不能为负");
        }
        if (request.shippingFeeType() != null
                && !Set.of("MANUAL", "TEMPLATE").contains(request.shippingFeeType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "发货运费来源只能是 MANUAL 或 TEMPLATE");
        }
        String logistics = (request.logisticsCompany() != null && !request.logisticsCompany().isBlank())
                ? request.logisticsCompany()
                : pickLogistics();
        String waybill = (request.waybillNo() != null && !request.waybillNo().isBlank())
                ? request.waybillNo()
                : nextWaybill();
        try {
            PythonShipRequest pyReq = new PythonShipRequest(
                    order.getPlatform(), order.getPlatformOrderId(), logistics, waybill);
            PlatformTask platformTask = platformTaskService.begin(
                    "SHIP:ORDER:" + order.getId(), "SHIP", "ORDER", order.getId(),
                    order.getPlatform(), objectMapper.convertValue(request, java.util.Map.class));
            if ("COMPLETED".equals(platformTask.getStatus())) return order;
            PythonShipResult result;
            if ("EXTERNAL_SUCCEEDED".equals(platformTask.getStatus())) {
                result = objectMapper.convertValue(platformTask.getResponseJson(), PythonShipResult.class);
            } else {
                platformTaskService.markRunning(platformTask.getId());
                result = pythonAgentClient.shipOrder(pyReq);
            }
            if (Boolean.FALSE.equals(result.success())) {
                // 平台拒绝受理：保留在待重试态，记录原因，不发货。
                order.setStatus("SHIPPING_FAILED");
                order.setFulfillmentSuggestionStatus("SHIPPING_FAILED");
                order.setPendingReason(result.message() != null ? result.message() : "平台拒绝受理发货");
                Order saved = orderRepository.save(order);
                auditService.record("ORDER", "ORDER", saved.getId(), "SHIP_FAILED",
                        before, saved.getStatus(), saved.getPendingReason());
                platformTaskService.failed(platformTask.getId(), saved.getPendingReason());
                return saved;
            }
            if (!"EXTERNAL_SUCCEEDED".equals(platformTask.getStatus())) {
                platformTaskService.externalSucceeded(platformTask.getId(), objectMapper.convertValue(result, java.util.Map.class));
            }
            if (order.getReservedQuantity() == null || order.getReservedQuantity() != order.getQuantity()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "订单没有完整库存预留，无法发货，请重新判定库存");
            }
            if (inventoryRepository.shipReservedStock(order.getProduct().getId(), order.getQuantity()) == 0) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "预留库存异常，无法完成出库");
            }
            order.setReservedQuantity(0);
            movementService.record(order.getProduct().getId(), "ORDER_SHIP",
                    -order.getQuantity(), -order.getQuantity(), "ORDER", order.getId(), "订单发货出库");
            // 受理成功：写回物流与发货时间，翻成已发货。
            order.setLogisticsCompany(logistics);
            order.setWaybillNo(waybill);
            // 发货运费（卖家 -> 买家）：发货时手填，用于后续订单毛利核算。
            order.setShippingFee(request.shippingFee());
            order.setShippingFeeType(request.shippingFeeType() != null ? request.shippingFeeType() : "MANUAL");
            // 成本/毛利快照（历史不漂）：以发货时商品当前成本价为准固化，后续商品成本变动不影响本单毛利。
            // 毛利口径契约（接平台前必须统一）：grossProfit = payment(买家总支付,含邮费) − goodsCost − shippingFee(商家实际运费)。
            // 若平台把 payment 拆成「商品实付 + postFee」，则此处需改成 payment + postFee − goodsCost − shippingFee。
            java.math.BigDecimal snapshotCost = order.getProduct().getCostPrice();
            java.math.BigDecimal goodsCost = snapshotCost
                    .multiply(java.math.BigDecimal.valueOf(order.getQuantity()))
                    .setScale(2, java.math.RoundingMode.HALF_UP);
            java.math.BigDecimal fee = order.getShippingFee() != null ? order.getShippingFee() : java.math.BigDecimal.ZERO;
            java.math.BigDecimal profit = order.getPayment().subtract(goodsCost).subtract(fee).setScale(2, java.math.RoundingMode.HALF_UP);
            order.setCostPriceSnapshot(snapshotCost);
            order.setGoodsCostSnapshot(goodsCost);
            order.setGrossProfit(profit);
            order.setStatus("SHIPPED");
            order.setFulfillmentSuggestionStatus("SHIPPED");
            order.setPendingReason(null);
            order.setShippedAt(java.time.Instant.now());
            salesRecordingService.recordShipment(order);
            Order saved = orderRepository.save(order);
            auditService.record("ORDER", "ORDER", saved.getId(), "SHIP",
                    before, saved.getStatus(), "物流：" + logistics + "，运单号：" + waybill);
            platformTaskService.completeAfterCommit(platformTask.getId(),
                    "Platform shipment succeeded but the local transaction rolled back");
            return saved;
        } catch (PythonAgentException e) {
            // 平台发货服务调用失败（如未启动）：同样落 SHIPPING_FAILED 待重试，不让前端静默成功。
            order.setStatus("SHIPPING_FAILED");
            order.setFulfillmentSuggestionStatus("SHIPPING_FAILED");
            order.setPendingReason(e.getMessage());
            Order saved = orderRepository.save(order);
            auditService.record("ORDER", "ORDER", saved.getId(), "SHIP_FAILED",
                    before, saved.getStatus(), saved.getPendingReason());
            PlatformTask task = platformTaskService.findByKey("SHIP:ORDER:" + order.getId());
            if (task != null) platformTaskService.failed(task.getId(), e.getMessage());
            return saved;
        } catch (RuntimeException e) {
            PlatformTask task = platformTaskService.findByKey("SHIP:ORDER:" + order.getId());
            if (task != null && "EXTERNAL_SUCCEEDED".equals(task.getStatus())) {
                platformTaskService.needsReconciliation(task.getId(), "平台已发货，本地落库失败：" + e.getMessage());
            }
            throw e;
        }
    }

    /**
     * 人工审核决议（单一真相源）：
     * - APPROVE：先校验单据完整性（已付款 ∧ 地址完整 ∧ 库存充足），任一不满足直接 409 拒绝并给出原因，
     *   强制运营先处理前置项，避免"点了就通过"；全部满足才清除 manualReviewRequired 并放行履约（READY_TO_SHIP）。
     * - REJECT：置 REJECTED（终态，不履约），由商家在平台侧线下取消/退款；
     *   本系统不删单、不自动取消，避免越权替平台决策。
     */
    @Transactional
    public Order review(Order order, boolean approve) {
        order = lockOrder(order.getId());
        Long productId = order.getProduct().getId();
        String before = order.getStatus();
        if (!approve) {
            releaseReservation(order, "人工审核驳回释放库存预留");
            order.setManualReviewRequired(false);
            order.setPendingReason(null);
            order.setStatus("REJECTED");
            order.setFulfillmentSuggestionStatus("REJECTED");
            Order saved = orderRepository.save(order);
            auditService.record("ORDER", "ORDER", saved.getId(), "REVIEW_REJECT",
                    before, saved.getStatus(), "人工审核驳回");
            return saved;
        }

        // 审核通过前必须先校验单据完整性：未付款 / 地址不全 / 库存不足 都不得被"放行"。
        // 不静默回退到待分析，而是直接拒绝并给出可读原因，强制运营先处理完前置项再审核。
        if (Boolean.FALSE.equals(order.getPaid())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "订单尚未付款，请先在「待付款」中确认已付款，再审核通过");
        }
        if (Boolean.FALSE.equals(order.getAddressComplete())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "收货地址不完整，请先确认地址已补全，再审核通过");
        }
        Inventory inventory = inventoryRepository.findByProductId(productId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Inventory not found for product: " + productId));
        int available = inventory.getCurrentStock() - inventory.getReservedStock();
        if (available < order.getQuantity()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "库存不足（可售 " + available + " < 订单 " + order.getQuantity()
                            + "），请先生成补货计划补足库存，再审核通过");
        }

        // 单据已完整：清除人工审核标记，放行履约（仍回写履约结论快照保持一致）。
        order.setManualReviewRequired(false);
        order.setPendingReason(null);
        PythonOrderFulfillmentRequest request = PythonOrderFulfillmentRequest.from(order, inventory);
        PythonFulfillmentResult result = pythonAgentClient.callOrderFulfillment(request);
        order.setFulfillmentSuggestionStatus("READY_TO_SHIP");
        order.setStatus("READY_TO_SHIP");
        order.setFulfillmentPlanJson(result.toJsonMap());
        reserveStockIfReady(order);
        if (!"READY_TO_SHIP".equals(order.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "库存不足或库存已被其他订单占用，请先补货再审核通过");
        }
        Order saved = orderRepository.save(order);
        auditService.record("ORDER", "ORDER", saved.getId(), "REVIEW_APPROVE",
                before, saved.getStatus(), "人工审核通过");
        return saved;
    }

    @Transactional
    public Order cancel(Order order, String reason) {
        order = lockOrder(order.getId());
        if (Set.of("SHIPPED", "RETURNED", "CANCELLED", "REFUNDED").contains(order.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "当前状态不能取消：" + order.getStatus());
        }
        String before = order.getStatus();
        releaseReservation(order, "订单取消释放库存");
        order.setStatus("CANCELLED");
        order.setFulfillmentSuggestionStatus("CANCELLED");
        order.setReverseReason(requireReason(reason));
        order.setCancelledAt(java.time.Instant.now());
        order.setPendingReason(null);
        Order saved = orderRepository.save(order);
        auditService.record("ORDER", "ORDER", saved.getId(), "CANCEL", before, saved.getStatus(), saved.getReverseReason());
        return saved;
    }

    @Transactional
    public Order refund(Order order, String reason) {
        order = lockOrder(order.getId());
        if (!Set.of("CANCELLED", "REJECTED", "SHIPPED").contains(order.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "仅已取消、已驳回或已发货订单可以退款");
        }
        String before = order.getStatus();
        releaseReservation(order, "退款释放库存预留");
        if (order.getShippedAt() != null) {
            salesRecordingService.reverseRefund(order);
            java.math.BigDecimal goodsCost = order.getGoodsCostSnapshot() != null
                    ? order.getGoodsCostSnapshot() : java.math.BigDecimal.ZERO;
            java.math.BigDecimal shippingFee = order.getShippingFee() != null
                    ? order.getShippingFee() : java.math.BigDecimal.ZERO;
            order.setGrossProfit(goodsCost.add(shippingFee).negate());
        } else {
            order.setGrossProfit(java.math.BigDecimal.ZERO);
        }
        order.setStatus("REFUNDED");
        order.setFulfillmentSuggestionStatus("REFUNDED");
        order.setReverseReason(requireReason(reason));
        order.setRefundedAt(java.time.Instant.now());
        Order saved = orderRepository.save(order);
        auditService.record("ORDER", "ORDER", saved.getId(), "REFUND", before, saved.getStatus(), saved.getReverseReason());
        return saved;
    }

    @Transactional
    public Order confirmReturn(Order order, String reason) {
        order = lockOrder(order.getId());
        if (!"REFUNDED".equals(order.getStatus()) || order.getShippedAt() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "仅已发货且已退款订单可以确认退货入库");
        }
        if (inventoryRepository.incrementStock(order.getProduct().getId(), order.getQuantity()) == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "退货入库失败：库存记录不存在");
        }
        movementService.record(order.getProduct().getId(), "ORDER_RETURN",
                order.getQuantity(), 0, "ORDER", order.getId(), "退货重新入库");
        String before = order.getStatus();
        java.math.BigDecimal shippingFee = order.getShippingFee() != null
                ? order.getShippingFee() : java.math.BigDecimal.ZERO;
        order.setGrossProfit(shippingFee.negate());
        order.setStatus("RETURNED");
        order.setFulfillmentSuggestionStatus("RETURNED");
        order.setReverseReason(requireReason(reason));
        order.setReturnedAt(java.time.Instant.now());
        Order saved = orderRepository.save(order);
        auditService.record("ORDER", "ORDER", saved.getId(), "RETURN_STOCK_IN", before, saved.getStatus(), saved.getReverseReason());
        return saved;
    }

    /** 所有进入可发货的路径都必须在数据库层原子预留库存。 */
    private void reserveStockIfReady(Order order) {
        if (!"READY_TO_SHIP".equals(order.getStatus())) {
            return;
        }
        if (!reserve(order)) {
            order.setStatus("INSUFFICIENT_STOCK");
            order.setFulfillmentSuggestionStatus("INSUFFICIENT_STOCK");
            order.setPendingReason(null);
        }
    }

    private boolean reserve(Order order) {
        if (order.getReservedQuantity() != null && order.getReservedQuantity() == order.getQuantity()) {
            return true;
        }
        if (inventoryRepository.reserveStockIfAvailable(order.getProduct().getId(), order.getQuantity()) == 0) {
            return false;
        }
        order.setReservedQuantity(order.getQuantity());
        movementService.record(order.getProduct().getId(), "ORDER_RESERVE",
                0, order.getQuantity(), "ORDER", order.getId(), "订单进入可发货，预留库存");
        return true;
    }

    private void releaseReservation(Order order, String reason) {
        int quantity = order.getReservedQuantity() != null ? order.getReservedQuantity() : 0;
        if (quantity <= 0) return;
        if (inventoryRepository.releaseReservedStock(order.getProduct().getId(), quantity) == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "库存预留记录异常，无法释放");
        }
        order.setReservedQuantity(0);
        movementService.record(order.getProduct().getId(), "ORDER_RELEASE",
                0, -quantity, "ORDER", order.getId(), reason);
    }

    private String requireReason(String reason) {
        if (reason == null || reason.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "必须填写处理原因");
        }
        return reason.trim();
    }

    private Order lockOrder(Long id) {
        return orderRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在：" + id));
    }

    private static final String[] LOGISTICS = {"顺丰速运", "中通快递", "圆通速递", "韵达快递", "京东物流"};

    private String pickLogistics() {
        return LOGISTICS[new java.util.Random().nextInt(LOGISTICS.length)];
    }

    private String nextWaybill() {
        return String.valueOf(10000000000000L + Math.abs(new java.util.Random().nextLong()) % 90000000000000L);
    }
}
