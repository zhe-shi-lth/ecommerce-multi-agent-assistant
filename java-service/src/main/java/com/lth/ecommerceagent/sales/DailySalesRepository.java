package com.lth.ecommerceagent.sales;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DailySalesRepository extends JpaRepository<DailySales, Long> {
    List<DailySales> findByProductIdOrderBySaleDateAsc(Long productId);
}
