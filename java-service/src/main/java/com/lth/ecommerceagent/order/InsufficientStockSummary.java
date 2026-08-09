package com.lth.ecommerceagent.order;

/**
 * 库存不足订单的按商品汇总（前端「销售监控」警告板块使用）。
 *
 * <p>只统计 {@code INSUFFICIENT_STOCK} 订单：backlogQuantity=这些订单的销量合计，
 * orderCount=订单笔数；currentStock / shortQuantity 由调用方按商品库存回填
 * （shortQuantity = max(0, backlogQuantity − currentStock)，即还需补多少货才能把这批积压订单都发出去）。
 */
public class InsufficientStockSummary {

    private final Long productId;
    private final String productName;
    private final long backlogQuantity;
    private final long orderCount;
    private int currentStock;
    private int shortQuantity;

    public InsufficientStockSummary(Long productId, String productName, long backlogQuantity, long orderCount) {
        this.productId = productId;
        this.productName = productName;
        this.backlogQuantity = backlogQuantity;
        this.orderCount = orderCount;
    }

    public Long getProductId() {
        return productId;
    }

    public String getProductName() {
        return productName;
    }

    public long getBacklogQuantity() {
        return backlogQuantity;
    }

    public long getOrderCount() {
        return orderCount;
    }

    public int getCurrentStock() {
        return currentStock;
    }

    public void setCurrentStock(int currentStock) {
        this.currentStock = currentStock;
    }

    public int getShortQuantity() {
        return shortQuantity;
    }

    public void setShortQuantity(int shortQuantity) {
        this.shortQuantity = shortQuantity;
    }
}
