package com.lth.ecommerceagent.order;

/**
 * 批量「重新判定」库存不足订单的统计结果（前端订单 tab「重新判定全部」按钮的回执）。
 *
 * <p>total=参与判定的 INSUFFICIENT_STOCK 订单数；readyToShip=库存充足已翻回可发货的笔数；
 * stillInsufficient=库存仍不足、保持原状的笔数；other=因未付款/地址不全被翻回待分析等其他态的笔数。
 */
public class RecheckAllResult {

    private final int total;
    private int readyToShip;
    private int stillInsufficient;
    private int other;

    public RecheckAllResult(int total, int readyToShip, int stillInsufficient, int other) {
        this.total = total;
        this.readyToShip = readyToShip;
        this.stillInsufficient = stillInsufficient;
        this.other = other;
    }

    public int getTotal() {
        return total;
    }

    public int getReadyToShip() {
        return readyToShip;
    }

    public int getStillInsufficient() {
        return stillInsufficient;
    }

    public int getOther() {
        return other;
    }

    public void incrementReady() {
        readyToShip++;
    }

    public void incrementStillShort() {
        stillInsufficient++;
    }

    public void incrementOther() {
        other++;
    }
}
