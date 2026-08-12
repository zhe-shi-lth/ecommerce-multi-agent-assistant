package com.lth.ecommerceagent.media;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.lth.ecommerceagent.operation.OperationPlan;
@Service
public class MediaAssetService {
 private final MediaAssetRepository repository; public MediaAssetService(MediaAssetRepository r){repository=r;}
 @Transactional public void registerPlanAssets(OperationPlan plan){Map<String,Object> json=plan.getImagePlanJson();if(json==null)return;register(plan,json.get("main_image_url"),"IMAGE");register(plan,json.get("scene_image_url"),"IMAGE");register(plan,json.get("marketing_image_url"),"IMAGE");Object v=json.get("video_url");if(v==null)v=json.get("generated_video_url");register(plan,v,"VIDEO");}
 private void register(OperationPlan p,Object value,String type){if(value==null)return;String url=String.valueOf(value);if(url.isBlank()||repository.existsByOperationPlanIdAndStorageUrl(p.getId(),url))return;MediaAsset a=new MediaAsset();a.setProduct(p.getProduct());a.setOperationPlan(p);a.setAssetType(type);a.setSourceUrl(url);a.setStorageUrl(url);repository.save(a);}
 @Transactional(readOnly=true) public List<MediaAssetResponse> list(Long planId){return repository.findByOperationPlanIdOrderByCreatedAt(planId).stream().map(MediaAssetResponse::from).toList();}
}
