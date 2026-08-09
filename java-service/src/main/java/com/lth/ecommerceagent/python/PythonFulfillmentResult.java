package com.lth.ecommerceagent.python;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 响应体，对应 Python 侧 FulfillmentPlan（地址补全重算后的履约结论）。
 * 字段名使用 snake_case 以匹配 FastAPI 的 Pydantic 模型。
 */
public record PythonFulfillmentResult(
        @JsonProperty("can_ship") Boolean canShip,
        @JsonProperty("fulfillment_status") String fulfillmentStatus,
        @JsonProperty("risk_flags") List<String> riskFlags,
        @JsonProperty("manual_review_required") Boolean manualReviewRequired,
        @JsonProperty("next_order_status") String nextOrderStatus,
        @JsonProperty("logistics_risk_level") String logisticsRiskLevel,
        @JsonProperty("anomaly_details") List<String> anomalyDetails,
        @JsonProperty("suggested_actions") List<String> suggestedActions,
        @JsonProperty("after_sale_suggested") Boolean afterSaleSuggested,
        @JsonProperty("after_sale_reason") String afterSaleReason) {

    /** 把履约结论包装为可落库的 JSON Map（写入 orders.fulfillment_plan_json）。 */
    public Map<String, Object> toJsonMap() {
        Map<String, Object> map = new java.util.LinkedHashMap<>();
        map.put("canShip", canShip);
        map.put("fulfillmentStatus", fulfillmentStatus);
        map.put("riskFlags", riskFlags);
        map.put("manualReviewRequired", manualReviewRequired);
        map.put("nextOrderStatus", nextOrderStatus);
        map.put("logisticsRiskLevel", logisticsRiskLevel);
        map.put("anomalyDetails", anomalyDetails);
        map.put("suggestedActions", suggestedActions);
        map.put("afterSaleSuggested", afterSaleSuggested);
        map.put("afterSaleReason", afterSaleReason);
        return map;
    }
}
