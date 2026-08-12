package com.lth.ecommerceagent.media;
import java.time.Instant;
public record MediaAssetResponse(Long id,Long productId,Long operationPlanId,String assetType,String storageUrl,Instant createdAt){public static MediaAssetResponse from(MediaAsset a){return new MediaAssetResponse(a.getId(),a.getProduct()==null?null:a.getProduct().getId(),a.getOperationPlan()==null?null:a.getOperationPlan().getId(),a.getAssetType(),a.getStorageUrl(),a.getCreatedAt());}}
