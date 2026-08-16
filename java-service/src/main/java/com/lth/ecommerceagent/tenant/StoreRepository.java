package com.lth.ecommerceagent.tenant;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface StoreRepository extends JpaRepository<Store,Long>{
    List<Store> findByStatusOrderByCreatedAt(String status);
    List<Store> findByCompanyIdAndStatusOrderByCreatedAt(Long companyId,String status);
    Optional<Store> findByIdAndCompanyIdAndStatus(Long id,Long companyId,String status);
    boolean existsByCompanyIdAndCode(Long companyId,String code);
}
