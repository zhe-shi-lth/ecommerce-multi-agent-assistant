package com.lth.ecommerceagent.user;

import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserRepository userRepository;

    public UserController(UserRepository userRepository) {
        this.userRepository = userRepository;
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
}
