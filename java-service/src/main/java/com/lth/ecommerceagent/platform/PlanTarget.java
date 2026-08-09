package com.lth.ecommerceagent.platform;

/**
 * 一个「取单对象」：某商品在某平台的一条已确认运营计划。
 *
 * <p>模拟来源据此逐单造数；真实来源把它交给 Python 适配器，用于圈定"该店铺里属于这个商品的订单"。
 * platformItemId 目前系统内还没有维护（运营计划未记录平台商品编号），先传 null，
 * 由适配器按 productName 匹配或在接入时补齐该字段。
 */
public record PlanTarget(
        String platform,
        Long planId,
        Long productId,
        String productName,
        // 售价：模拟来源据此算实付金额；真实来源用平台返回的实付，不看这里
        java.math.BigDecimal salePrice,
        String platformItemId) {
}
