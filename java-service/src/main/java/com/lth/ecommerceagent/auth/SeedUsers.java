package com.lth.ecommerceagent.auth;

import com.lth.ecommerceagent.user.User;
import com.lth.ecommerceagent.user.UserRepository;

import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * 首次启动（users 表为空）时种子两个演示账号：
 *   - 超级管理员 admin@shop.local / admin123（可见「用户监控」「测试」tab）
 *   - 普通用户   user@shop.local  / user123（仅常规 tab）
 * 密码由 BCrypt 加密写入，保证可移植且不落明文。
 */
@Component
public class SeedUsers implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public SeedUsers(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        if (userRepository.count() == 0) {
            userRepository.save(new User(
                    "admin@shop.local", passwordEncoder.encode("admin123"), "SUPER_ADMIN"));
            userRepository.save(new User(
                    "user@shop.local", passwordEncoder.encode("user123"), "USER"));
        }
    }
}
