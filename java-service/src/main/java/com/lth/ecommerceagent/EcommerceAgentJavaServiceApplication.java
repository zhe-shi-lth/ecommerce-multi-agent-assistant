package com.lth.ecommerceagent;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class EcommerceAgentJavaServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(EcommerceAgentJavaServiceApplication.class, args);
    }
}
