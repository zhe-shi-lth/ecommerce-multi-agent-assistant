package com.lth.ecommerceagent.tenant;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface StoreMemberRepository extends JpaRepository<StoreMember,Long>{
    Optional<StoreMember> findByStoreIdAndUserIdAndStatus(Long storeId,Long userId,String status);
    List<StoreMember> findByCompanyIdAndStatus(Long companyId,String status);
    List<StoreMember> findByUserIdAndStatus(Long userId,String status);
    List<StoreMember> findByStoreIdAndStatus(Long storeId,String status);
    List<StoreMember> findByStoreId(Long storeId);
    void deleteByStoreId(Long storeId);
}
