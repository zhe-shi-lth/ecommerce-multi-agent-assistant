package com.lth.ecommerceagent.simulation;

import java.util.List;

/**
 * 当前订单数据来源信息（前端据此切换"平台模拟" / "平台订单同步"界面）。
 *
 * @param source    mock=本地模拟造数；real=平台开放 API 拉取
 * @param platforms 已对接(凭证齐全)的平台列表；mock 模式为空
 */
public record DataSourceInfo(String source, List<String> platforms) {
}
