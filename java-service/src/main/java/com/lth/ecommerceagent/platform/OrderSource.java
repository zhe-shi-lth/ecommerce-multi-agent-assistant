package com.lth.ecommerceagent.platform;

import java.util.List;

/**
 * 订单来源：把"订单从哪来"这件事收敛成一个接口。
 *
 * <p>{@link MockOrderSource} 本地造数，{@link RealOrderSource} 经 Python 适配器调平台开放 API。
 * 两者只产出<b>事实</b>（付款/地址/复核标记等），业务状态与入库由 SimulationService 统一处理，
 * 因此从 mock 切到 real 时，库表结构、Agent 逻辑、前端页面都不需要改。
 */
public interface OrderSource {

    /** 来源标识，会写进 orders.source：mock / real。 */
    String name();

    /** 取回一批订单；返回空列表表示这段时间没有新订单。 */
    List<PulledOrder> pull(OrderPullCommand command);
}
