package com.lth.ecommerceagent.auth;

import io.jsonwebtoken.Claims;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import com.lth.ecommerceagent.tenant.*;
import com.lth.ecommerceagent.user.UserRepository;

/**
 * 从 Authorization: Bearer <JWT> 解析出用户与角色，写入 SecurityContext。
 * 仅在有 Bearer 头时生效；解析失败则清空上下文（交由后续授权判断返回 401）。
 * 注：不标注 @Component，避免被 Spring Boot 当作普通 servlet Filter 自动注册两次；
 * 由 SecurityConfig 手动 new 后通过 addFilterBefore 加入安全过滤链。
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;
    private final CompanyMemberRepository memberRepository;
    private final StoreRepository storeRepository;
    private final StoreMemberRepository storeMemberRepository;
    private final StoreMemberPermissionRepository permissionRepository;

    public JwtAuthenticationFilter(JwtService jwtService, UserRepository userRepository,
            CompanyRepository companyRepository, CompanyMemberRepository memberRepository,
            StoreRepository storeRepository, StoreMemberRepository storeMemberRepository,
            StoreMemberPermissionRepository permissionRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.companyRepository = companyRepository;
        this.memberRepository = memberRepository;
        this.storeRepository = storeRepository;
        this.storeMemberRepository = storeMemberRepository; this.permissionRepository = permissionRepository;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            try {
                Claims claims = jwtService.parse(token);
                Long userId = claims.get("uid", Long.class);
                Long companyId = claims.get("companyId", Long.class);
                Long storeId = claims.get("storeId", Long.class);
                var user = userRepository.findById(userId).orElseThrow();
                if (("SUPER_ADMIN".equals(user.getRole()) || "PLATFORM_ADMIN".equals(user.getRole())) && companyId == null) {
                    var principal = new TenantPrincipal(user.getId(), user.getEmail(), user.getRole(), null, null, null, null,
                            MemberRole.OWNER, java.util.Set.of(Permission.values()));
                    var auth = new UsernamePasswordAuthenticationToken(principal, null, java.util.List.of(
                            new SimpleGrantedAuthority("ROLE_" + user.getRole())));
                    SecurityContextHolder.getContext().setAuthentication(auth);
                    filterChain.doFilter(request, response);
                    return;
                }
                var company = companyRepository.findById(companyId).filter(c -> "ACTIVE".equals(c.getStatus())).orElseThrow();
                var companyMember = memberRepository.findByCompanyIdAndUserIdAndStatus(companyId, userId, "ACTIVE").orElse(null);
                if (storeId == null && companyMember != null && companyMember.getRole() == MemberRole.OWNER) {
                    var principal = new TenantPrincipal(user.getId(), user.getEmail(), user.getRole(), companyId, company.getName(), null, null,
                            companyMember.getRole(), java.util.Set.of(Permission.values()));
                    var authorities = new java.util.ArrayList<SimpleGrantedAuthority>();
                    authorities.add(new SimpleGrantedAuthority("ROLE_OWNER"));
                    for (var permission : Permission.values()) {
                        authorities.add(new SimpleGrantedAuthority("PERM_" + permission.name()));
                    }
                    var auth = new UsernamePasswordAuthenticationToken(principal, null, authorities);
                    SecurityContextHolder.getContext().setAuthentication(auth);
                    filterChain.doFilter(request, response);
                    return;
                }
                var store = storeRepository.findByIdAndCompanyIdAndStatus(storeId, companyId, "ACTIVE").orElseThrow();
                var storeMember = storeMemberRepository.findByStoreIdAndUserIdAndStatus(storeId,userId,"ACTIVE").orElse(null);
                if ("SUPER_ADMIN".equals(user.getRole())) storeMember = null;
                if (companyMember == null && storeMember == null && !"SUPER_ADMIN".equals(user.getRole())) throw new IllegalStateException("not a tenant member");
                var role = companyMember != null ? companyMember.getRole() : MemberRole.OPERATOR;
                var permissions = role == MemberRole.OWNER
                        ? java.util.EnumSet.allOf(Permission.class)
                        : (storeMember == null ? java.util.Set.<Permission>of() : permissionRepository.findByStoreMemberId(storeMember.getId()).stream().map(StoreMemberPermission::getPermission).collect(java.util.stream.Collectors.toSet()));
                var principal = new TenantPrincipal(user.getId(), user.getEmail(), user.getRole(), companyId,
                        company.getName(), storeId, store.getName(), role, permissions);
                var authorities = new java.util.ArrayList<SimpleGrantedAuthority>();
                authorities.add(new SimpleGrantedAuthority("ROLE_" + role.name()));
                if ("SUPER_ADMIN".equals(user.getRole())) authorities.add(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN"));
                permissions.forEach(p -> authorities.add(new SimpleGrantedAuthority("PERM_" + p.name())));
                var auth = new UsernamePasswordAuthenticationToken(principal, null, authorities);
                auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (Exception e) {
                SecurityContextHolder.clearContext();
            }
        }
        filterChain.doFilter(request, response);
    }
}
