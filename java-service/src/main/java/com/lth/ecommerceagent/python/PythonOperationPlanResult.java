package com.lth.ecommerceagent.python;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 响应体，对应 Python 侧 OperationPlanResult。
 * 字段名使用 snake_case 以匹配 FastAPI 的 Pydantic 模型。
 */
public record PythonOperationPlanResult(
        @JsonProperty("trace_id") String traceId,
        @JsonProperty("product_plan") ProductPlan productPlan,
        @JsonProperty("image_plan") ImagePlan imagePlan,
        @JsonProperty("inventory_plan") InventoryPlan inventoryPlan,
        @JsonProperty("fulfillment_plan") FulfillmentPlan fulfillmentPlan,
        @JsonProperty("final_summary") String finalSummary,
        @JsonProperty("manual_review_required") Boolean manualReviewRequired,
        @JsonProperty("errors") List<Map<String, Object>> errors,
        @JsonProperty("agent_runs") List<AgentRunRecord> agentRuns) {

    public record ProductPlan(
            @JsonProperty("recommended_title") String recommendedTitle,
            @JsonProperty("selling_points") List<String> sellingPoints,
            @JsonProperty("detail_description") String detailDescription,
            @JsonProperty("target_user_summary") String targetUserSummary,
            @JsonProperty("listing_suggestion") String listingSuggestion) {
    }

    public record ImagePlan(
            @JsonProperty("main_image_prompt") String mainImagePrompt,
            @JsonProperty("scene_image_prompt") String sceneImagePrompt,
            @JsonProperty("marketing_image_prompt") String marketingImagePrompt,
            @JsonProperty("image_style") String imageStyle,
            @JsonProperty("image_risk_notes") List<String> imageRiskNotes) {
    }

    public record InventoryPlan(
            @JsonProperty("inventory_status") String inventoryStatus,
            @JsonProperty("should_restock") Boolean shouldRestock,
            @JsonProperty("suggested_restock_quantity") Integer suggestedRestockQuantity,
            @JsonProperty("restock_priority") String restockPriority,
            @JsonProperty("reason") String reason) {
    }

    public record FulfillmentPlan(
            @JsonProperty("can_ship") Boolean canShip,
            @JsonProperty("fulfillment_status") String fulfillmentStatus,
            @JsonProperty("risk_flags") List<String> riskFlags,
            @JsonProperty("manual_review_required") Boolean manualReviewRequired,
            @JsonProperty("next_order_status") String nextOrderStatus) {
    }

    public record AgentRunRecord(
            @JsonProperty("agent_name") String agentName,
            @JsonProperty("status") String status,
            @JsonProperty("duration_ms") Integer durationMs,
            @JsonProperty("input_json") Map<String, Object> inputJson,
            @JsonProperty("output_json") Map<String, Object> outputJson,
            @JsonProperty("error_message") String errorMessage) {
    }
}
