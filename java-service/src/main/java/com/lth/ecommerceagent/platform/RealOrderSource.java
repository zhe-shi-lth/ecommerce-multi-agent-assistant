package com.lth.ecommerceagent.platform;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import com.lth.ecommerceagent.python.PythonAgentClient;
import com.lth.ecommerceagent.python.PythonPullOrdersRequest;
import com.lth.ecommerceagent.python.PythonPullOrdersResult;

/**
 * 真实订单来源：经 Python 平台适配器调各平台开放 API 取单。
 *
 * <p>Java 不持有任何平台密钥——凭证只存在 Python 的设置中心里；这里只发"要哪些商品、最近几天"，
 * 拿回平台中立结构后交给 SimulationService 统一落库。
 *
 * <p>失败闭合：某个平台没对接好，Python 会把中文原因放进 warnings；
 * 如果一个平台都没取成，直接报错给用户（不静默当作"今天没有新订单"）。
 */
@Component
public class RealOrderSource implements OrderSource {

    private final PythonAgentClient pythonAgentClient;

    public RealOrderSource(PythonAgentClient pythonAgentClient) {
        this.pythonAgentClient = pythonAgentClient;
    }

    @Override
    public String name() {
        return "real";
    }

    @Override
    public List<PulledOrder> pull(OrderPullCommand command) {
        List<PythonPullOrdersRequest.PlanTargetPayload> plans = command.targets().stream()
                .map(t -> new PythonPullOrdersRequest.PlanTargetPayload(
                        t.platform(), t.planId(), t.productId(), t.productName(), t.platformItemId()))
                .toList();

        PythonPullOrdersResult result =
                pythonAgentClient.pullPlatformOrders(new PythonPullOrdersRequest(plans, command.days()));

        List<String> warnings = result.warnings() == null ? List.of() : result.warnings();
        List<String> reached = result.platforms() == null ? List.of() : result.platforms();
        if (reached.isEmpty() && !warnings.isEmpty()) {
            // 一个平台都没拉成：把原因原样给用户，别让页面显示"0 单"当作正常结果。
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, String.join("；", warnings));
        }

        List<PulledOrder> orders = new ArrayList<>();
        for (PythonPullOrdersResult.PlatformOrderPayload o : nullSafe(result.orders())) {
            orders.add(toPulled(o));
        }
        return orders;
    }

    private static <T> List<T> nullSafe(List<T> list) {
        return list == null ? List.of() : list;
    }

    private PulledOrder toPulled(PythonPullOrdersResult.PlatformOrderPayload o) {
        return new PulledOrder(
                o.platform(),
                o.platformOrderId(),
                o.planId(),
                o.productId(),
                o.quantity() == null ? 1 : o.quantity(),
                Boolean.TRUE.equals(o.paid()),
                Boolean.TRUE.equals(o.addressComplete()),
                Boolean.TRUE.equals(o.manualReviewRequired()),
                parseDate(o.orderDate()),
                o.receiverName(),
                o.receiverPhone(),
                o.receiverProvince(),
                o.receiverCity(),
                o.receiverDistrict(),
                o.receiverDetail(),
                o.buyerNick(),
                o.payment() == null ? BigDecimal.ZERO : o.payment(),
                o.postFee() == null ? BigDecimal.ZERO : o.postFee(),
                o.logisticsCompany(),
                o.waybillNo(),
                Boolean.TRUE.equals(o.encrypted()));
    }

    // 平台日期缺失/格式异常时按今天计（只影响日销归属的那一天，不影响订单本身）。
    private LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) {
            return LocalDate.now();
        }
        try {
            return LocalDate.parse(value.trim().substring(0, 10));
        } catch (RuntimeException e) {
            return LocalDate.now();
        }
    }
}
