package com.lth.ecommerceagent.tenant;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
public interface StoreMemberPermissionRepository extends JpaRepository<StoreMemberPermission,Long>{
    List<StoreMemberPermission> findByStoreMemberId(Long storeMemberId);
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from StoreMemberPermission p where p.storeMemberId = :storeMemberId")
    void deleteByStoreMemberId(@Param("storeMemberId") Long storeMemberId);
}
