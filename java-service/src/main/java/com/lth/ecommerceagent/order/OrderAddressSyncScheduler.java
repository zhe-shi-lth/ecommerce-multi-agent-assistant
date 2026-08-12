package com.lth.ecommerceagent.order;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.lth.ecommerceagent.python.PythonAddressStatusResult;
import com.lth.ecommerceagent.python.PythonAgentClient;
import com.lth.ecommerceagent.python.PythonAgentException;
import com.lth.ecommerceagent.python.PythonPaymentStatusResult;

/**
 * 地址补全定时轮询：自动回写平台侧的 address_complete 真相，免去运营逐单手动点「确认地址已补全」。
 *
 * <p>模式无关：轮询走 {@code PlatformAdapter.get_address_complete}——已配置真实凭证则查官方 API，
 * 未配置（模拟器模式）则由适配器返回同构的模拟真相。因此「模拟器」与「官方 API」走完全相同的落库路径，
 * 接上官方 API 即可直接用，无需改动本任务逻辑。
 *
 * <p>每轮取「待分析 + 地址未补全」的订单（限 batch-size 个），逐单查询平台；平台确认已补全则复用
 * {@link OrderCompletionService#markAddressComplete} 流转状态。查询失败（Python 不可用 / 平台未对接）
 * 失败闭合：跳过该单、不改状态、记录日志，不影响本轮其余订单。
 *
 * <p>超时升级：地址未补全或仍未付款、且创建时间超过 {@code sla-days} 天的订单，统一升级为
 * {@code NEEDS_REVIEW}（保留 pendingReason 以区分来源），提示运营联系买家补全/付款或取消/退款，
 * 避免无限期卡在待分析。付款复核与地址复核对称：各自走 {@code PlatformAdapter.get_paid} /
 * {@code get_address_complete}，手动「确认已付款」与「确认地址已补全」也共用同一套落库路径。
 */
@Component
public class OrderAddressSyncScheduler {

    private static final Logger log = LoggerFactory.getLogger(OrderAddressSyncScheduler.class);

    private final OrderRepository orderRepository;
    private final OrderCompletionService orderCompletionService;
    private final PythonAgentClient pythonAgentClient;

    private final boolean enabled;
    private final int batchSize;
    private final int slaDays;

    public OrderAddressSyncScheduler(
            OrderRepository orderRepository,
            OrderCompletionService orderCompletionService,
            PythonAgentClient pythonAgentClient,
            @Value("${order.address-sync.enabled:true}") boolean enabled,
            @Value("${order.address-sync.batch-size:50}") int batchSize,
            @Value("${order.address-sync.sla-days:7}") int slaDays) {
        this.orderRepository = orderRepository;
        this.orderCompletionService = orderCompletionService;
        this.pythonAgentClient = pythonAgentClient;
        this.enabled = enabled;
        this.batchSize = batchSize;
        this.slaDays = slaDays;
    }

    @Scheduled(fixedDelayString = "${order.address-sync.fixed-delay-ms:60000}")
    public void sync() {
        if (!enabled) {
            return;
        }
        healCheck();
        paymentCheck();
        escalateOverdue();
    }

    /** 向平台复核地址是否补全：已补全则自动流转状态（模式无关，模拟器=官方 API 替身）。 */
    private void healCheck() {
        List<Order> pending = orderRepository.findByStatusAndAddressCompleteFalse("PENDING_ANALYSIS", false);
        if (pending.isEmpty()) {
            return;
        }
        int processed = 0;
        int autoCompleted = 0;
        for (Order order : pending) {
            if (processed >= batchSize) {
                break;
            }
            processed++;
            String platform = order.getPlatform();
            String platformOrderId = order.getPlatformOrderId();
            // 没有平台单号/平台（历史 unspecified 数据）无法向平台复核，跳过。
            if (platform == null || platform.isBlank() || platformOrderId == null || platformOrderId.isBlank()) {
                continue;
            }
            try {
                PythonAddressStatusResult status =
                        pythonAgentClient.checkAddressStatus(platform, platformOrderId);
                if (status.complete()) {
                    orderCompletionService.markAddressComplete(order);
                    autoCompleted++;
                    log.info("地址补全轮询：订单 {}（平台 {}）平台确认已补全，已自动流转状态", order.getId(), platform);
                }
            } catch (PythonAgentException e) {
                // 查询失败（Python 不可用 / 平台未对接）：失败闭合，跳过该单，不阻断本轮。
                log.warn("地址补全轮询：订单 {} 查询平台状态失败，本轮跳过：{}", order.getId(), e.getMessage());
            }
        }
        if (autoCompleted > 0) {
            log.info("地址补全轮询完成：扫描 {} 单，自动补全 {} 单", processed, autoCompleted);
        }
    }

    /** 向平台复核付款状态：已付款则自动流转状态（模式无关，模拟器=官方 API 替身）。对称 healCheck。 */
    private void paymentCheck() {
        List<Order> pending = orderRepository.findByStatusAndPaidFalse("PENDING_ANALYSIS", false);
        if (pending.isEmpty()) {
            return;
        }
        int processed = 0;
        int autoPaid = 0;
        for (Order order : pending) {
            if (processed >= batchSize) {
                break;
            }
            processed++;
            String platform = order.getPlatform();
            String platformOrderId = order.getPlatformOrderId();
            // 没有平台单号/平台（历史 unspecified 数据）无法向平台复核，跳过。
            if (platform == null || platform.isBlank() || platformOrderId == null || platformOrderId.isBlank()) {
                continue;
            }
            try {
                PythonPaymentStatusResult status =
                        pythonAgentClient.checkPaymentStatus(platform, platformOrderId);
                if (status.paid()) {
                    orderCompletionService.markPaid(order);
                    autoPaid++;
                    log.info("付款复核轮询：订单 {}（平台 {}）平台确认已付款，已自动流转状态", order.getId(), platform);
                }
            } catch (PythonAgentException e) {
                // 查询失败（Python 不可用 / 平台未对接）：失败闭合，跳过该单，不阻断本轮。
                log.warn("付款复核轮询：订单 {} 查询平台付款状态失败，本轮跳过：{}", order.getId(), e.getMessage());
            }
        }
        if (autoPaid > 0) {
            log.info("付款复核轮询完成：扫描 {} 单，自动标记已付款 {} 单", processed, autoPaid);
        }
    }

    /** 超时升级：地址未补全或仍未付款，且超过 sla-days 天未处理 → 升级为需人工审核（保留 pendingReason）。 */
    private void escalateOverdue() {
        if (slaDays <= 0) {
            return;
        }
        Instant deadline = java.time.Instant.now().minus(java.time.Duration.ofDays(slaDays));
        List<Order> overdue =
                orderRepository.findOverduePendingAnalysis("PENDING_ANALYSIS", deadline);
        if (overdue.isEmpty()) {
            return;
        }
        int escalated = 0;
        for (Order order : overdue) {
            if (escalated >= batchSize) {
                break;
            }
            // 保留 pendingReason，使运营能区分"超时的是地址不全还是未付款"。
            orderCompletionService.escalateOverdue(order.getId(), slaDays);
            escalated++;
            log.info("待处理超时升级：订单 {} 超过 {} 天仍未处理（{}），已升级为需人工审核",
                    order.getId(), slaDays, order.getPendingReason());
        }
        if (escalated > 0) {
            log.info("待处理超时升级完成：本轮回升 {} 单", escalated);
        }
    }
}
