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

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserController(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    /** 用户监控：仅超级管理员可见。普通用户访问返回 403。 */
    @GetMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public List<UserResponse> list() {
        return userRepository.findAll().stream()
                .map(u -> new UserResponse(
                        u.getEmail(),
                        u.getRole(),
                        u.getCreatedAt(),
                        u.getLastLoginAt()))
                .toList();
    }

    public record CreateUserRequest(String email, String password, String role) {}

    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");
    private static final List<String> VALID_ROLES = List.of("SUPER_ADMIN", "USER");

    /** 新建账号：仅超级管理员可操作。密码以 BCrypt 加密落库，不返回明文。 */
    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> create(@RequestBody CreateUserRequest request) {
        if (request.email() == null || !EMAIL_PATTERN.matcher(request.email().trim()).matches()) {
            return badRequest("请输入有效的邮箱地址");
        }
        if (request.password() == null || request.password().length() < 6) {
            return badRequest("密码至少 6 位");
        }
        String role = request.role() == null || request.role().isBlank() ? "USER" : request.role().trim().toUpperCase();
        if (!VALID_ROLES.contains(role)) {
            return badRequest("角色仅支持 SUPER_ADMIN 或 USER");
        }
        String email = request.email().trim().toLowerCase();
        if (userRepository.existsByEmail(email)) {
            return badRequest("该邮箱已存在");
        }
        User saved = userRepository.save(new User(email, passwordEncoder.encode(request.password()), role));
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new UserResponse(saved.getEmail(), saved.getRole(), saved.getCreatedAt(), saved.getLastLoginAt()));
    }

    private static ResponseEntity<Map<String, String>> badRequest(String message) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", message));
    }
}
