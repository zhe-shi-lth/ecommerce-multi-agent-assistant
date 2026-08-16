package com.lth.ecommerceagent.tenant;
import java.time.Instant;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
@Entity @Table(name="store_platform_configs",uniqueConstraints=@UniqueConstraint(columnNames={"store_id","platform"}))
public class StorePlatformConfig{
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(name="company_id",nullable=false) private Long companyId;
 @Column(name="store_id",nullable=false) private Long storeId;
 @Column(nullable=false,length=20) private String platform;
 @Column(name="credentials_ciphertext",nullable=false,columnDefinition="text") private String credentialsCiphertext;
 @Column(nullable=false) private boolean enabled=true;
 @CreationTimestamp @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
 @UpdateTimestamp @Column(name="updated_at",nullable=false) private Instant updatedAt;
 public Long getId(){return id;} public Long getCompanyId(){return companyId;} public void setCompanyId(Long v){companyId=v;}
 public Long getStoreId(){return storeId;} public void setStoreId(Long v){storeId=v;} public String getPlatform(){return platform;} public void setPlatform(String v){platform=v;}
 public String getCredentialsCiphertext(){return credentialsCiphertext;} public void setCredentialsCiphertext(String v){credentialsCiphertext=v;}
 public boolean isEnabled(){return enabled;} public void setEnabled(boolean v){enabled=v;} public Instant getUpdatedAt(){return updatedAt;}
}
