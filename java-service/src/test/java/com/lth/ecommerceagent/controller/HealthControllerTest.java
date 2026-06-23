package com.lth.ecommerceagent.controller;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;

class HealthControllerTest {

    @Test
    void healthReturnsServiceStatus() {
        Map<String, String> response = new HealthController().health();

        assertThat(response)
                .containsEntry("service", "ecommerce-agent-java-service")
                .containsEntry("status", "ok");
    }
}
