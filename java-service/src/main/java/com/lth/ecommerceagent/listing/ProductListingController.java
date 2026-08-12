package com.lth.ecommerceagent.listing;

import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/product-listings")
public class ProductListingController {
    private final ProductListingService service;
    public ProductListingController(ProductListingService service) { this.service = service; }
    @GetMapping public List<ProductListingResponse> list(@RequestParam(required = false) Long productId) {
        return service.list(productId);
    }
}
