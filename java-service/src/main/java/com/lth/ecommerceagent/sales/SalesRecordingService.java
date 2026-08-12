package com.lth.ecommerceagent.sales;

import java.math.BigDecimal;
import java.time.LocalDate;

import org.springframework.stereotype.Service;

import com.lth.ecommerceagent.order.Order;

@Service
public class SalesRecordingService {
    private final DailySalesRepository repository;

    public SalesRecordingService(DailySalesRepository repository) {
        this.repository = repository;
    }

    public void recordShipment(Order order) {
        adjust(order, order.getQuantity(), order.getPayment(), 1);
    }

    public void reverseRefund(Order order) {
        adjust(order, -order.getQuantity(), order.getPayment().negate(), -1);
    }

    public void reverseAfterSale(Order order, int quantity, BigDecimal amount) {
        adjust(order, -quantity, amount.negate(), quantity >= order.getQuantity() ? -1 : 0);
    }

    private void adjust(Order order, int unitsDelta, BigDecimal revenueDelta, int countDelta) {
        LocalDate date = order.getShippedAt() != null
                ? order.getShippedAt().atZone(java.time.ZoneId.systemDefault()).toLocalDate()
                : LocalDate.now();
        DailySales sales = repository.findByProductIdAndPlatformAndSaleDate(
                order.getProduct().getId(), order.getPlatform(), date).orElseGet(() -> {
                    DailySales created = new DailySales();
                    created.setProductId(order.getProduct().getId());
                    created.setPlatform(order.getPlatform());
                    created.setSaleDate(date);
                    created.setRevenue(BigDecimal.ZERO);
                    created.setUnits(0);
                    created.setOrderCount(0);
                    return created;
                });
        sales.setRevenue(sales.getRevenue().add(revenueDelta));
        sales.setUnits(Math.max(0, sales.getUnits() + unitsDelta));
        sales.setOrderCount(Math.max(0, sales.getOrderCount() + countDelta));
        repository.save(sales);
    }
}
