package com.lth.ecommerceagent.python;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 发货回写请求，对应 Python 侧 PlatformAdapter.ship_order 的入参。
 * 字段名使用 snake_case 以匹配 FastAPI 的 Pydantic 模型。
 */
public record PythonShipRequest(
        @JsonProperty("platform") String platform,
        @JsonProperty("platform_order_id") String platformOrderId,
        @JsonProperty("logistics_company") String logisticsCompany,
        @JsonProperty("waybill_no") String waybillNo) {
}
