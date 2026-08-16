package com.lth.ecommerceagent.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Date;
import com.lth.ecommerceagent.tenant.TenantPrincipal;

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
        // HS256 要求密钥 >= 256 位；为兼容任意长度的用户密钥，统一用 SHA-256 派生 32 字节密钥。
        // 必须与 Python 侧 get_current_user 的派生方式一致（sha256(secret)），保证两端可互验令牌。
        try {
            byte[] keyBytes = MessageDigest.getInstance("SHA-256")
                    .digest(secret.getBytes(StandardCharsets.UTF_8));
            this.key = new SecretKeySpec(keyBytes, "HmacSHA256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 算法不可用", e);
        }
        this.expirationMs = expirationMs;
    }

    public String generateToken(TenantPrincipal principal) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMs);
        return Jwts.builder()
                .subject(principal.email())
                .claim("uid", principal.userId())
                .claim("role", principal.globalRole())
                .claim("companyId", principal.companyId())
                .claim("storeId", principal.storeId())
                .claim("memberRole", principal.memberRole().name())
                .claim("permissions", principal.permissions().stream().map(Enum::name).toList())
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
