package com.lth.ecommerceagent.order;

/**
 * 发货入参：商家在订单详情手动选择的物流信息（回写平台发货 API 用）。
 * 物流公司可由前端下拉选择；运单号留空则由后端生成（与模拟器同构）。
 * shippingFee / shippingFeeType 为本次「卖家 -> 买家」的实际发货运费，与采购单进货运费严格区分。
 */
public record ShipRequest(
        String logisticsCompany,
        String waybillNo,
        java.math.BigDecimal shippingFee,
        String shippingFeeType) {
}
