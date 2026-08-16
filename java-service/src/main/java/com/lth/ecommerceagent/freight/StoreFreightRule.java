package com.lth.ecommerceagent.freight;

import java.math.BigDecimal;
import com.lth.ecommerceagent.tenant.TenantContext;
import jakarta.persistence.*;

@Entity
@Table(name="store_freight_rules", uniqueConstraints=@UniqueConstraint(columnNames={"store_id","province"}))
public class StoreFreightRule {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="company_id",nullable=false) private Long companyId;
    @Column(name="store_id",nullable=false) private Long storeId;
    @Column(nullable=false,length=40) private String province;
    @Column(nullable=false,precision=12,scale=2) private BigDecimal fee;
    @PrePersist void tenant(){if(companyId==null)companyId=TenantContext.companyId();if(storeId==null)storeId=TenantContext.storeId();}
    public Long getId(){return id;} public Long getCompanyId(){return companyId;} public Long getStoreId(){return storeId;}
    public String getProvince(){return province;} public void setProvince(String v){province=v;}
    public BigDecimal getFee(){return fee;} public void setFee(BigDecimal v){fee=v;}
}
