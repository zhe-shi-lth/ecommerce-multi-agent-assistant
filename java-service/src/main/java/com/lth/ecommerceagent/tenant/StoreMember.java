package com.lth.ecommerceagent.tenant;

import java.time.Instant;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name="store_members", uniqueConstraints=@UniqueConstraint(columnNames={"store_id","user_id"}))
public class StoreMember {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="company_id", nullable=false) private Long companyId;
    @Column(name="store_id", nullable=false) private Long storeId;
    @Column(name="user_id", nullable=false) private Long userId;
    @Column(nullable=false,length=20) private String status="ACTIVE";
    @CreationTimestamp @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    @UpdateTimestamp @Column(name="updated_at",nullable=false) private Instant updatedAt;
    public Long getId(){return id;} public Long getCompanyId(){return companyId;} public void setCompanyId(Long v){companyId=v;}
    public Long getStoreId(){return storeId;} public void setStoreId(Long v){storeId=v;} public Long getUserId(){return userId;} public void setUserId(Long v){userId=v;}
    public String getStatus(){return status;} public void setStatus(String v){status=v;}
}
