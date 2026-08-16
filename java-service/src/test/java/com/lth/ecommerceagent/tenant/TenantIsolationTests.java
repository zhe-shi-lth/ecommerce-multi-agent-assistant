package com.lth.ecommerceagent.tenant;

import static org.assertj.core.api.Assertions.assertThat;
import java.math.BigDecimal;
import java.util.List;
import com.lth.ecommerceagent.product.Product;
import com.lth.ecommerceagent.product.ProductRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

@DataJpaTest
class TenantIsolationTests {
    @Autowired ProductRepository products;

    @AfterEach void clear(){SecurityContextHolder.clearContext();}

    @Test void listAndFindByIdAreIsolatedByCurrentStore(){
        authenticate(1,11); Product first=products.saveAndFlush(product("store-one"));
        authenticate(1,22); Product second=products.saveAndFlush(product("store-two"));
        assertThat(products.findAll()).extracting(Product::getName).containsExactly("store-two");
        assertThat(products.findById(first.getId())).isEmpty();
        assertThat(products.findById(second.getId())).isPresent();
    }

    private void authenticate(long companyId,long storeId){
        TenantPrincipal principal=new TenantPrincipal(9L,"owner@test.local","USER",companyId,"company",storeId,"store",MemberRole.OWNER);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal,null,List.of(new SimpleGrantedAuthority("ROLE_OWNER"))));
    }
    private Product product(String name){
        Product p=new Product();p.setName(name);p.setCategory("test");p.setDescription("test");p.setCostPrice(BigDecimal.ONE);p.setSalePrice(BigDecimal.TEN);p.setTargetAudience("");p.setUsageScenario("");p.setStatus("DRAFT");return p;
    }
}
