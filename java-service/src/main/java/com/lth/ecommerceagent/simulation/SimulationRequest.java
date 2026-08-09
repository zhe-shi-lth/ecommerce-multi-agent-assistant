package com.lth.ecommerceagent.simulation;

import java.util.List;

/**
 * 平台订单模拟拉取请求（本地造数，不调用真实平台 API）。
 *
 * 拉单对象改为「已确认(CONFIRMED)的运营计划」：计划才代表商品已真正在某平台上架，
 * 一个商品可能尚未发布、也可能在多个平台分别发布，因此不能用「商品+平台」造单。
 *
 * - planIds：本次要模拟的已确认计划；为空时模拟全部已确认计划。
 * - platform：可选，作为已确认计划的平台过滤条件（仅当 planIds 为空时生效）。
 * - days/maxOrdersPerDay/maxQty 为空时由 service 取默认值。
 */
public record SimulationRequest(
        String platform,
        List<Long> planIds,
        Integer days,
        Integer maxOrdersPerDay,
        Integer maxQty) {
}
