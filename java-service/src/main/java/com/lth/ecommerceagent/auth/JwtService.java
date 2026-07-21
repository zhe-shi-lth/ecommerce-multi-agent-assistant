package com.lth.ecommerceagent.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * HS256 JWT 签发与解析。密钥与 Python 服务共用（来自 application.yml 的 jwt.secret，
 * 最终取自 .env 的 JWT_SECRET），保证两端可互验。
 */
@Service
public class JwtService {

    private final SecretKey key;
    private final long expirationMs;

    public JwtService(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.expiration-ms:86400000}") long expirationMs) {
        // 与 Python 侧 jwt.decode(token, JWT_SECRET) 保持一致：直接用密钥的 UTF-8 字节作为
        // HMAC-SHA256 密钥（不强制 32 字节）。使用 SecretKeySpec 而非 Keys.hmacShaKeyFor，
        // 后者会要求密钥 >= 32 字节，过短默认值会抛 WeakKeyException 导致启动失败。
        this.key = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        this.expirationMs = expirationMs;
    }

    public String generateToken(String email, String role) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMs);
        return Jwts.builder()
                .subject(email)
                .claim("role", role)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(key)
                .compact();
    }

    public Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
