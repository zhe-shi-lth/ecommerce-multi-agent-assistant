package com.lth.ecommerceagent.aftersale;
import java.math.BigDecimal;
public record AfterSalesRequest(Long orderId, String type, Integer quantity, BigDecimal refundAmount, String reason) {}
