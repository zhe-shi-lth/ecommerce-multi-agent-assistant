package com.lth.ecommerceagent.python;

import java.util.Map;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.lth.ecommerceagent.operation.OperationPlan;
import com.lth.ecommerceagent.product.Product;

public record PythonPublishListingRequest(
        @JsonProperty("platform") String platform,
        @JsonProperty("plan_id") Long planId,
        @JsonProperty("product_id") Long productId,
        @JsonProperty("product_name") String productName,
        @JsonProperty("product_plan") Map<String, Object> productPlan,
        @JsonProperty("image_plan") Map<String, Object> imagePlan,
        @JsonProperty("video_url") String videoUrl) {

    public static PythonPublishListingRequest from(OperationPlan plan) {
        Product product = plan.getProduct();
        Map<String, Object> imagePlan = plan.getImagePlanJson();
        return new PythonPublishListingRequest(
                plan.getPlatform(),
                plan.getId(),
                product != null ? product.getId() : null,
                product != null ? product.getName() : null,
                plan.getProductPlanJson(),
                imagePlan,
                extractVideoUrl(imagePlan));
    }

    private static String extractVideoUrl(Map<String, Object> imagePlan) {
        if (imagePlan == null) {
            return null;
        }
        Object direct = imagePlan.get("video_url");
        if (direct == null) {
            direct = imagePlan.get("generated_video_url");
        }
        return direct == null ? null : String.valueOf(direct);
    }
}
