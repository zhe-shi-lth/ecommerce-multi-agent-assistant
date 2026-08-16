package com.lth.ecommerceagent.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * 服务间调用鉴权：Python <-> Java 双向闭环的写回/编排调用携带 X-Service-Key 头，
 * 命中配置的 service.api-key 即视为内部服务身份（ROLE_SERVICE），放行 /api/**。
 * 仅在尚无认证信息（Bearer）时生效，JWT 用户身份优先。
 * 注：不标注 @Component，由 SecurityConfig 手动 new 后加入安全过滤链。
 */
public class ServiceKeyFilter extends OncePerRequestFilter {

    private final String serviceKey;

    public ServiceKeyFilter(String serviceKey) {
        this.serviceKey = serviceKey;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {
        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            String key = request.getHeader("X-Service-Key");
            if (key != null && !key.isBlank() && key.equals(serviceKey)) {
                String companyHeader=request.getHeader("X-Company-Id");
                String storeHeader=request.getHeader("X-Store-Id");
                Object principal="service";
                if(companyHeader!=null&&storeHeader!=null){
                    principal=new com.lth.ecommerceagent.tenant.TenantPrincipal(null,"service","SERVICE",
                            Long.valueOf(companyHeader),"SERVICE",Long.valueOf(storeHeader),"SERVICE",
                            com.lth.ecommerceagent.tenant.MemberRole.OWNER,java.util.Set.of(com.lth.ecommerceagent.tenant.Permission.values()));
                }
                var authorities = new java.util.ArrayList<SimpleGrantedAuthority>();
                authorities.add(new SimpleGrantedAuthority("ROLE_SERVICE"));
                authorities.add(new SimpleGrantedAuthority("ROLE_OWNER"));
                for (var permission : com.lth.ecommerceagent.tenant.Permission.values()) {
                    authorities.add(new SimpleGrantedAuthority("PERM_" + permission.name()));
                }
                var auth = new UsernamePasswordAuthenticationToken(principal, null, authorities);
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        }
        filterChain.doFilter(request, response);
    }
}
