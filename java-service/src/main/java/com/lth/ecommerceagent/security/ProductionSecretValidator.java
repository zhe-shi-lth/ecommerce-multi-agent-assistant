package com.lth.ecommerceagent.security;

import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
public class ProductionSecretValidator {
    public ProductionSecretValidator(
            Environment environment,
            @Value("${jwt.secret}") String jwtSecret,
            @Value("${service.api-key}") String serviceApiKey) {
        String appEnvironment = environment.getProperty("APP_ENV", "development");
        if (!List.of("prod", "production").contains(appEnvironment.toLowerCase())) {
            return;
        }
        List<String> invalid = new ArrayList<>();
        check("JWT_SECRET", jwtSecret, invalid);
        check("SERVICE_API_KEY", serviceApiKey, invalid);
        if (!invalid.isEmpty()) {
            throw new IllegalStateException(
                    "Production secrets are missing, too short, or use development defaults: "
                            + String.join(", ", invalid));
        }
    }

    private void check(String name, String value, List<String> invalid) {
        if (value == null || value.length() < 32 || value.startsWith("dev-")) {
            invalid.add(name);
        }
    }
}
