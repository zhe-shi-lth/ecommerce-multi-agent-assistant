package com.lth.ecommerceagent.user;

import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.lth.ecommerceagent.tenant.*;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final CompanyRepository companies;
    private final CompanyMemberRepository companyMembers;
    private final StoreMemberRepository storeMembers;
    private final StoreRepository stores;

    public UserController(UserRepository userRepository, PasswordEncoder passwordEncoder, CompanyRepository companies,
            CompanyMemberRepository companyMembers, StoreMemberRepository storeMembers, StoreRepository stores) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.companies = companies; this.companyMembers = companyMembers; this.storeMembers = storeMembers; this.stores = stores;
    }

    /** 用户监控：仅超级管理员可见。普通用户访问返回 403。 */
    @GetMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','PLATFORM_ADMIN','OWNER')")
    public List<UserResponse> list() {
        var principal = TenantContext.principal();
        var visible = (principal != null && (principal.isSuperAdmin() || "PLATFORM_ADMIN".equals(principal.globalRole())))
                ? userRepository.findAll()
                : userRepository.findAll().stream().filter(u -> visibleToCompany(u, principal.companyId())).toList();
        return visible.stream()
                .map(u -> new UserResponse(
                        u.getId(), u.getEmail(), u.getDisplayName(),
                        u.getRole(), u.getStatus(),
                        u.getCreatedAt(),
                        u.getLastLoginAt(), memberships(u.getId())))
                .toList();
    }

    public record CreateUserRequest(String email, String displayName, String password, String role, Long companyId) {}

    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");
    private static final List<String> VALID_ROLES = List.of("SUPER_ADMIN", "USER");

    /** 新建账号：仅超级管理员可操作。密码以 BCrypt 加密落库，不返回明文。 */
    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','PLATFORM_ADMIN','OWNER')")
    public ResponseEntity<?> create(@RequestBody CreateUserRequest request) {
        if (request.email() == null || !EMAIL_PATTERN.matcher(request.email().trim()).matches()) {
            return badRequest("请输入有效的邮箱地址");
        }
        String password = request.password() == null || request.password().isBlank() ? "123457" : request.password();
        if (password.length() < 6) return badRequest("密码至少 6 位");
        var principal = TenantContext.principal();
        String role = request.role() == null || request.role().isBlank() ? "USER" : request.role().trim().toUpperCase();
        if ("SUPER_ADMIN".equals(principal.globalRole())) {
            if (!List.of("PLATFORM_ADMIN", "OWNER").contains(role)) return badRequest("平台超级管理员只能创建平台运营管理员或企业老板");
            if ("OWNER".equals(role) && request.companyId() == null) return badRequest("创建企业老板时必须选择所属企业");
        } else if (principal.memberRole() == MemberRole.OWNER) {
            if (!List.of("USER", "OWNER").contains(role)) return badRequest("企业老板只能创建联合老板或普通员工");
        } else {
            return badRequest("只能创建平台管理员或普通用户");
        }
        String email = request.email().trim().toLowerCase();
        if (userRepository.existsByEmail(email)) {
            return badRequest("该邮箱已存在");
        }
        User saved = new User(email, passwordEncoder.encode(password), role); saved.setDisplayName(request.displayName()); saved = userRepository.save(saved);
        if ("OWNER".equals(role)) { var cm = new CompanyMember(); cm.setCompanyId("SUPER_ADMIN".equals(principal.globalRole()) ? request.companyId() : principal.companyId()); cm.setUserId(saved.getId()); cm.setRole(MemberRole.OWNER); companyMembers.save(cm); }
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new UserResponse(saved.getId(), saved.getEmail(), saved.getDisplayName(), saved.getRole(), saved.getStatus(), saved.getCreatedAt(), saved.getLastLoginAt(), List.of()));
    }

    public record ProfileRequest(String displayName, String currentPassword, String newPassword) {}
    @GetMapping("/me") @PreAuthorize("isAuthenticated()")
    public UserResponse me() { var u = current(); return response(u); }
    @org.springframework.web.bind.annotation.PutMapping("/me") @PreAuthorize("isAuthenticated()")
    public UserResponse updateMe(@RequestBody ProfileRequest r) {
        var u = current();
        if (r.displayName() != null) u.setDisplayName(r.displayName().trim());
        if (r.newPassword() != null && !r.newPassword().isBlank()) {
            if (r.currentPassword() == null || !passwordEncoder.matches(r.currentPassword(), u.getPasswordHash())) throw new org.springframework.web.server.ResponseStatusException(HttpStatus.BAD_REQUEST, "当前密码不正确");
            if (r.newPassword().length() < 6) throw new org.springframework.web.server.ResponseStatusException(HttpStatus.BAD_REQUEST, "新密码至少 6 位");
            u.setPasswordHash(passwordEncoder.encode(r.newPassword()));
        }
        return response(userRepository.save(u));
    }
    private User current() { var p = TenantContext.principal(); if (p == null) throw new org.springframework.web.server.ResponseStatusException(HttpStatus.UNAUTHORIZED); return userRepository.findById(p.userId()).orElseThrow(); }
    @org.springframework.web.bind.annotation.PutMapping("/{id}/status") @PreAuthorize("hasAnyRole('SUPER_ADMIN','PLATFORM_ADMIN','OWNER')")
    public UserResponse updateStatus(@org.springframework.web.bind.annotation.PathVariable Long id, @RequestBody Map<String,String> body) {
        var actor = TenantContext.principal(); var target = userRepository.findById(id).orElseThrow();
        if (id.equals(actor.userId())) throw new org.springframework.web.server.ResponseStatusException(HttpStatus.BAD_REQUEST, "不能停用当前登录账号");
        boolean platform = actor.isSuperAdmin() || "PLATFORM_ADMIN".equals(actor.globalRole());
        if (!platform && (!"OWNER".equals(actor.memberRole().name()) || !visibleToCompany(target, actor.companyId()))) throw new org.springframework.web.server.ResponseStatusException(HttpStatus.FORBIDDEN, "无权修改该用户");
        if (platform && "SUPER_ADMIN".equals(target.getRole())) throw new org.springframework.web.server.ResponseStatusException(HttpStatus.FORBIDDEN, "不能停用平台超级管理员");
        target.setStatus("DISABLED".equalsIgnoreCase(body.getOrDefault("status", "ACTIVE")) ? "DISABLED" : "ACTIVE");
        return response(userRepository.save(target));
    }
    private UserResponse response(User u) { return new UserResponse(u.getId(), u.getEmail(), u.getDisplayName(), u.getRole(), u.getStatus(), u.getCreatedAt(), u.getLastLoginAt(), memberships(u.getId())); }

    private List<UserResponse.Membership> memberships(Long userId) {
        var result = new java.util.ArrayList<UserResponse.Membership>();
        for (var cm : companyMembers.findByUserIdAndStatus(userId, "ACTIVE")) {
            var company = companies.findById(cm.getCompanyId()).orElse(null);
            if (company != null) result.add(new UserResponse.Membership(company.getId(), company.getName(), cm.getRole().name(), null, null));
        }
        for (var sm : storeMembers.findByUserIdAndStatus(userId, "ACTIVE")) {
            var company = companies.findById(sm.getCompanyId()).orElse(null); var store = stores.findById(sm.getStoreId()).orElse(null);
            if (company != null && store != null) result.add(new UserResponse.Membership(company.getId(), company.getName(), "MEMBER", store.getId(), store.getName()));
        }
        return result;
    }
    private boolean visibleToCompany(User u, Long companyId) {
        return companyMembers.findByCompanyIdAndStatus(companyId, "ACTIVE").stream().anyMatch(m -> m.getUserId().equals(u.getId()))
                || storeMembers.findByCompanyIdAndStatus(companyId, "ACTIVE").stream().anyMatch(m -> m.getUserId().equals(u.getId()));
    }

    private static ResponseEntity<Map<String, String>> badRequest(String message) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", message));
    }
}
