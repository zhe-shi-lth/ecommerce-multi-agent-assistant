package com.lth.ecommerceagent.inventory;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;

public interface InventoryRepository extends JpaRepository<Inventory, Long> {

    @Override
    @EntityGraph(attributePaths = "product")
    List<Inventory> findAll();

    @Override
    @EntityGraph(attributePaths = "product")
    Optional<Inventory> findById(Long id);

    @EntityGraph(attributePaths = "product")
    Optional<Inventory> findByProductId(Long productId);
}
