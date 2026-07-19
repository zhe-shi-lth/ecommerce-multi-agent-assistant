package com.lth.ecommerceagent.simulation;

/** 平台订单模拟拉取结果汇总。 */
public record SimulationResult(int ordersCreated, int inventoriesUpdated, int dailySalesUpserted) {
}
