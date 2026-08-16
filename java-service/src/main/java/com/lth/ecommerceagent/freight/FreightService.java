package com.lth.ecommerceagent.freight;
import java.math.BigDecimal; import org.springframework.stereotype.Service; import com.lth.ecommerceagent.tenant.TenantContext;
@Service public class FreightService { private final StoreFreightRuleRepository repo; public FreightService(StoreFreightRuleRepository r){repo=r;}
 public BigDecimal fee(String province){if(province==null||province.isBlank())return BigDecimal.ZERO;var p=TenantContext.principal();return repo.findByStoreIdAndCompanyIdAndProvince(p.storeId(),p.companyId(),province.trim()).map(StoreFreightRule::getFee).orElse(BigDecimal.ZERO);}}
