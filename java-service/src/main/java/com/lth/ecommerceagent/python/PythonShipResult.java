package com.lth.ecommerceagent.python;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 平台发货回执，对应 Python 侧 ShipResult。
 * success=false 时 message 携带可读失败原因，Java 侧据此把订单置为 SHIPPING_FAILED 供重试。
 */
public record PythonShipResult(
        @JsonProperty("success") Boolean success,
        @JsonProperty("message") String message,
        @JsonProperty("platform_ship_status") String platformShipStatus) {
}
