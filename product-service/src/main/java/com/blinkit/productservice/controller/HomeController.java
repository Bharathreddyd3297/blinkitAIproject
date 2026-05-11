package com.blinkit.productservice.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class HomeController {

    @GetMapping("/")
    public Map<String, Object> root() {
        return Map.of(
                "service", "product-service",
                "version", "1.0.0",
                "status", "UP"
        );
    }

}
