package com.lth.ecommerceagent.sales;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DailySalesRepository extends JpaRepository<DailySales, Long> {
    List<DailySales> findByProductIdOrderBySaleDateAsc(Long productId);

    List<DailySales> findByPlatformOrderBySaleDateAsc(String platform);

    Optional<DailySales> findByProductIdAndPlatformAndSaleDate(Long productId, String platform, LocalDate saleDate);
}
