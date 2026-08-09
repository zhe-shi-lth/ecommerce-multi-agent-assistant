package com.lth.ecommerceagent.platform;

import java.math.BigDecimal;

/**
 * 从「订单来源」取回的一笔订单（平台中立形状）。
 *
 * <p>关键约定：来源只负责给出<b>事实</b>（是否已付款、地址是否完整、是否需人工复核等），
 * 不负责给出业务状态。status 由 {@code SimulationService.deriveStatus} 按同一套规则统一推导，
 * 这样「模拟」与「真实平台」两条路径产出的订单在库里完全同构，切换来源无需改动任何下游逻辑。
 *
 * @param platform        来源平台（taobao / douyin / xiaohongshu）
 * @param platformOrderId 平台侧订单号
 * @param planId          归属的运营计划 id（模拟按计划生成；真实按商品外部编号回填）
 * @param productId       归属商品 id
 * @param quantity        购买数量
 * @param paid            是否已付款
 * @param addressComplete 收件地址是否完整
 * @param manualReviewRequired 平台侧标记需要人工复核（风控/异常件等）
 * @param orderedOn       下单日期（yyyy-MM-dd，用于写日销）
 */
public record PulledOrder(
        String platform,
        String platformOrderId,
        Long planId,
        Long productId,
        int quantity,
        boolean paid,
        boolean addressComplete,
        boolean manualReviewRequired,
        java.time.LocalDate orderedOn,
        String receiverName,
        String receiverPhone,
        String receiverProvince,
        String receiverCity,
        String receiverDistrict,
        String receiverDetail,
        String buyerNick,
        BigDecimal payment,
        BigDecimal postFee,
        String logisticsCompany,
        String waybillNo,
        boolean encrypted) {
}
