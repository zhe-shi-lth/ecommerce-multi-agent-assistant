package com.lth.ecommerceagent.platform;

import java.util.List;

/**
 * 一次取单请求。
 *
 * <p>days 对两种来源都有意义（模拟=回填多少天；真实=拉最近多少天的订单）；
 * maxOrdersPerDay / maxQty 只对模拟来源有意义，真实来源忽略——单量由平台实际订单决定。
 */
public record OrderPullCommand(
        List<PlanTarget> targets,
        int days,
        int maxOrdersPerDay,
        int maxQty) {
}
