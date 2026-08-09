package com.lth.ecommerceagent.python;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 平台对接状态响应（GET /agent/ecommerce/platform/status）。
 *
 * <p>ready 为凭证齐全、可正常拉单的平台列表；前端据此在「订单同步」模式下列出已对接平台。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PythonPlatformStatus(
        @JsonProperty("ready") List<String> ready) {
}
