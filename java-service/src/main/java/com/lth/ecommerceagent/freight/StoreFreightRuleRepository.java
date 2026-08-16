package com.lth.ecommerceagent.freight;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface StoreFreightRuleRepository extends JpaRepository<StoreFreightRule,Long>{
 List<StoreFreightRule> findByStoreIdAndCompanyIdOrderByProvince(Long storeId,Long companyId);
 Optional<StoreFreightRule> findByStoreIdAndCompanyIdAndProvince(Long storeId,Long companyId,String province);
 void deleteByStoreIdAndCompanyId(Long storeId,Long companyId);
}
