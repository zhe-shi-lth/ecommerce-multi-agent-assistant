package com.lth.ecommerceagent.tenant;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface CompanyMemberRepository extends JpaRepository<CompanyMember,Long>{
    List<CompanyMember> findByUserIdAndStatus(Long userId,String status);
    List<CompanyMember> findByCompanyIdAndStatus(Long companyId,String status);
    Optional<CompanyMember> findByCompanyIdAndUserIdAndStatus(Long companyId,Long userId,String status);
}
