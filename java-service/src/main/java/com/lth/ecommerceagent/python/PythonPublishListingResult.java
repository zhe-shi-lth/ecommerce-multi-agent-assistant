package com.lth.ecommerceagent.python;

import java.util.Map;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record PythonPublishListingResult(
        @JsonProperty("success") Boolean success,
        @JsonProperty("platform") String platform,
        @JsonProperty("message") String message,
        @JsonProperty("external_item_id") String externalItemId,
        @JsonProperty("external_url") String externalUrl,
        @JsonProperty("raw") Map<String, Object> raw) {
}
