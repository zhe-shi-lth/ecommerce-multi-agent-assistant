package com.lth.ecommerceagent.python;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 响应体，对应 Python 侧 OrderMonitorAgent.verify 的复核结论。
 * verified=true 表示订单来源确认地址已补全，可继续流转；否则应拦截。
 */
public record PythonOrderVerifyResult(
        @JsonProperty("verified") Boolean verified,
        @JsonProperty("reason") String reason) {
}
