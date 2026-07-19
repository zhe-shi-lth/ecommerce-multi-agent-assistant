package com.lth.ecommerceagent.simulation;

import java.util.List;

/**
 * 平台订单模拟拉取请求（本地造数，不调用真实平台 API）。
 * platform 为本次拉取归属的平台（taobao/douyin/xiaohongshu），会写入订单与日销；
 * days/maxOrdersPerDay/maxQty 为空时由 service 取默认值。
 */
public record SimulationRequest(
        String platform,
        List<Long> productIds,
        Integer days,
        Integer maxOrdersPerDay,
        Integer maxQty) {
}
