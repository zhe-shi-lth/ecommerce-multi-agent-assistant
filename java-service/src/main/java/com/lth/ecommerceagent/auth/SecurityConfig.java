package com.lth.ecommerceagent.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.http.HttpStatus;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtService jwtService;
    private final com.lth.ecommerceagent.user.UserRepository userRepository;
    private final com.lth.ecommerceagent.tenant.CompanyRepository companyRepository;
    private final com.lth.ecommerceagent.tenant.CompanyMemberRepository memberRepository;
    private final com.lth.ecommerceagent.tenant.StoreRepository storeRepository;
    private final com.lth.ecommerceagent.tenant.StoreMemberRepository storeMemberRepository;
    private final com.lth.ecommerceagent.tenant.StoreMemberPermissionRepository permissionRepository;

    public SecurityConfig(JwtService jwtService, com.lth.ecommerceagent.user.UserRepository userRepository,
            com.lth.ecommerceagent.tenant.CompanyRepository companyRepository,
            com.lth.ecommerceagent.tenant.CompanyMemberRepository memberRepository,
            com.lth.ecommerceagent.tenant.StoreRepository storeRepository,
            com.lth.ecommerceagent.tenant.StoreMemberRepository storeMemberRepository,
            com.lth.ecommerceagent.tenant.StoreMemberPermissionRepository permissionRepository) {
        this.jwtService = jwtService;
        this.userRepository=userRepository; this.companyRepository=companyRepository;
        this.memberRepository=memberRepository; this.storeRepository=storeRepository;
        this.storeMemberRepository=storeMemberRepository; this.permissionRepository=permissionRepository;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            @Value("${service.api-key}") String serviceApiKey) throws Exception {
        // 自定义过滤器手动实例化并插入过滤链，避免被 Spring Boot 当作普通 servlet Filter 二次注册。
        ServiceKeyFilter serviceKeyFilter = new ServiceKeyFilter(serviceApiKey);
        JwtAuthenticationFilter jwtAuthenticationFilter = new JwtAuthenticationFilter(jwtService, userRepository,
                companyRepository, memberRepository, storeRepository, storeMemberRepository, permissionRepository);

        http
                .csrf(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth
                        // 登录与健康检查免认证；Swagger 文档便于本地联调也放开
                        .requestMatchers(
                                "/api/auth/login",
                                "/health",
                                "/docs",
                                "/swagger-ui/**",
                                "/v3/api-docs/**")
                        .permitAll()
                        .anyRequest()
                        .authenticated())
                // 未认证统一返回 401（而非 Spring 默认的 403），前端据此清空令牌并跳登录页；
                // 真正的「无权限」(已登录但角色不符) 才返回 403，不触发跳登录。
                .exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .addFilterBefore(serviceKeyFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
