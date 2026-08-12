package com.lth.ecommerceagent.media;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
public interface MediaAssetRepository extends JpaRepository<MediaAsset,Long>{boolean existsByOperationPlanIdAndStorageUrl(Long planId,String url);List<MediaAsset> findByOperationPlanIdOrderByCreatedAt(Long planId);}
