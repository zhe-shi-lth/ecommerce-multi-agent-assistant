package com.lth.ecommerceagent.listing;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductListingRepository extends JpaRepository<ProductListing, Long> {
    Optional<ProductListing> findByProductIdAndPlatform(Long productId, String platform);
    List<ProductListing> findByProductIdOrderByPlatform(Long productId);
    boolean existsByProductIdAndStatus(Long productId, String status);
}
