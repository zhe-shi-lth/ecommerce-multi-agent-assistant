package com.lth.ecommerceagent.python;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 响应体，对应 Python 侧 OrderMonitorAgent.verify_payment 的复核结论。
 * verified=true 表示订单来源确认已付款，可继续流转；否则应拦截。
 */
public record PythonPaymentVerifyResult(
        @JsonProperty("verified") Boolean verified,
        @JsonProperty("reason") String reason) {
}
