package com.lth.ecommerceagent.listing;

import java.util.List;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/product-listings")
@PreAuthorize("hasAuthority('PERM_PRODUCT_VIEW')")
public class ProductListingController {
    private final ProductListingService service;
    public ProductListingController(ProductListingService service) { this.service = service; }
    @GetMapping public List<ProductListingResponse> list(@RequestParam(required = false) Long productId) {
        return service.list(productId);
    }
}
