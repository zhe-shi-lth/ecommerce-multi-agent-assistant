package com.lth.ecommerceagent.listing;

import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.lth.ecommerceagent.operation.OperationPlan;
import com.lth.ecommerceagent.product.Product;
import com.lth.ecommerceagent.product.ProductRepository;
import com.lth.ecommerceagent.python.PythonPublishListingResult;

@Service
public class ProductListingService {
    private final ProductListingRepository repository;
    private final ProductRepository productRepository;

    public ProductListingService(ProductListingRepository repository, ProductRepository productRepository) {
        this.repository = repository;
        this.productRepository = productRepository;
    }

    @Transactional
    public ProductListing publish(OperationPlan plan, PythonPublishListingResult result) {
        ProductListing listing = repository.findByProductIdAndPlatform(plan.getProduct().getId(), plan.getPlatform())
                .orElseGet(ProductListing::new);
        listing.setProduct(plan.getProduct());
        listing.setOperationPlan(plan);
        listing.setPlatform(plan.getPlatform());
        listing.setStatus("PUBLISHED");
        listing.setExternalItemId(result.externalItemId());
        listing.setExternalUrl(result.externalUrl());
        listing.setLastMessage(result.message());
        listing.setPublishedAt(Instant.now());
        listing.setUnpublishedAt(null);
        ProductListing saved = repository.saveAndFlush(listing);
        syncProductStatus(plan.getProduct());
        return saved;
    }

    @Transactional
    public ProductListing unpublish(OperationPlan plan, String message) {
        ProductListing listing = repository.findByProductIdAndPlatform(plan.getProduct().getId(), plan.getPlatform())
                .orElseThrow();
        listing.setStatus("UNPUBLISHED");
        listing.setLastMessage(message);
        listing.setUnpublishedAt(Instant.now());
        ProductListing saved = repository.saveAndFlush(listing);
        syncProductStatus(plan.getProduct());
        return saved;
    }

    @Transactional(readOnly = true)
    public List<ProductListingResponse> list(Long productId) {
        List<ProductListing> rows = productId == null ? repository.findAll() : repository.findByProductIdOrderByPlatform(productId);
        return rows.stream().map(ProductListingResponse::from).toList();
    }

    private void syncProductStatus(Product product) {
        product.setStatus(repository.existsByProductIdAndStatus(product.getId(), "PUBLISHED") ? "PUBLISHED" : "DRAFT");
        productRepository.save(product);
    }
}
