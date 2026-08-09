package com.lth.ecommerceagent.python;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 平台订单地址完整标记响应（POST /agent/ecommerce/order-monitor/address-status）。
 *
 * <p>complete 即平台侧 address_complete（模拟器模式下为适配器返回的模拟真相）。
 * 查询失败（未配置 / 网络异常）时 Python 也返回 complete=false + 可读原因，Java 侧据此不改状态。
 */
public record PythonAddressStatusResult(
        @JsonProperty("complete") boolean complete,
        @JsonProperty("reason") String reason) {
}
