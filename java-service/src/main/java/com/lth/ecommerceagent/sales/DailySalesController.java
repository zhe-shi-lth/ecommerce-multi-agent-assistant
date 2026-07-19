package com.lth.ecommerceagent.sales;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/daily-sales")
public class DailySalesController {

    private final DailySalesRepository repository;

    public DailySalesController(DailySalesRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<DailySales> list(
            @RequestParam(required = false) Long productId,
            @RequestParam(required = false) String platform) {
        if (productId != null) {
            return repository.findByProductIdOrderBySaleDateAsc(productId);
        }
        if (platform != null && !platform.isBlank()) {
            return repository.findByPlatformOrderBySaleDateAsc(platform);
        }
        return repository.findAll();
    }
}
