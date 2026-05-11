package com.blinkit.authservice.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class HomeController {

    @GetMapping("/")
    public Map<String, Object> home() {
        return Map.of(
                "service", "auth-service",
                "version", "1.0.0",
                "status", "running",
                "endpoints", Map.of(
                        "health", "GET /actuator/health",
                        "signup", "POST /api/auth/signup",
                        "login", "POST /api/auth/login",
                        "getUser", "GET /api/auth/user/{id}"
                )
        );
    }
}
