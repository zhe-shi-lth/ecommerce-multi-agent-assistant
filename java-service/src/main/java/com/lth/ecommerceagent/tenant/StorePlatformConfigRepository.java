package com.lth.ecommerceagent.tenant;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface StorePlatformConfigRepository extends JpaRepository<StorePlatformConfig,Long>{
    List<StorePlatformConfig> findByStoreIdOrderByPlatform(Long storeId);
    Optional<StorePlatformConfig> findByStoreIdAndPlatform(Long storeId,String platform);
    void deleteByStoreId(Long storeId);
}
