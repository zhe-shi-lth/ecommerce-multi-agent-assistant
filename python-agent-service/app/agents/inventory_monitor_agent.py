"""线2 库存监控 Agent：基于实际日销 + 节假日/大促事件日历，智能估算"可售天数"。

这是线2（监控类型）的核心智能：
- 发布前审核（确定性 DB 校验）由 Java 端完成，本 Agent 不负责。
- 本 Agent 负责"销售监控"页的**智能预警**：按真实日销估算可售天数，
  并叠加事件日历（618 / 双11 / 春节 / 国庆等）上调未来需求，
  可售天数 < 5 天则判定为预警。

无 LLM Key 时，事件日历的确定性估算已足够产出预警，不依赖外部模型。
"""

from datetime import date, timedelta
from typing import Optional

from pydantic import BaseModel

from app.llm.client import get_llm_client


class _Event:
    def __init__(self, name: str, month: int, day: int, window: int, multiplier: float):
        self.name = name
        self.month = month
        self.day = day
        self.window = window  # 事件前多少天进入影响窗口
        self.multiplier = multiplier


# 促销/节假日事件日历：在窗口内上调预期日需求。
EVENTS = [
    _Event("618 大促", 6, 18, 14, 3.0),
    _Event("双11 大促", 11, 11, 21, 3.0),
    _Event("双12 大促", 12, 12, 14, 2.5),
    _Event("国庆黄金周", 10, 1, 10, 1.8),
    _Event("春节", 2, 10, 21, 2.0),
    _Event("七夕", 8, 22, 7, 1.6),
    _Event("情人节", 2, 14, 7, 1.6),
]


class MonitorAdvisory(BaseModel):
    advisory: str


def _event_multiplier(reference: date):
    """返回 (倍率, 命中事件名列表)。取窗口内最大倍率。"""
    best = 1.0
    hits = []
    this_year = reference.year
    for ev in EVENTS:
        occ = date(this_year, ev.month, ev.day)
        if occ < reference:
            occ = date(this_year + 1, ev.month, ev.day)
        days_until = (occ - reference).days
        # 事件前 window 天、到事件当天后 1 天，都算影响窗口
        if -1 <= days_until <= ev.window:
            if ev.multiplier > best:
                best = ev.multiplier
            hits.append(ev.name)
    return best, hits


class InventoryMonitorAgent:
    """估算单个商品的可售天数，并产出预警。"""

    def run(
        self,
        inventory: dict,
        daily_sales: list[dict],
        product_name: str,
        reference_date: Optional[date] = None,
    ) -> dict:
        reference = reference_date or date.today()
        current_stock = int(inventory.get("currentStock") or 0)

        # 实际日销（取日销记录 units 均值）
        units = [int(d.get("units") or 0) for d in daily_sales]
        avg_daily_demand = (sum(units) / len(units)) if units else 0.0

        # 事件智能：叠加促销/节假日倍率
        multiplier, hits = _event_multiplier(reference)
        adjusted_demand = avg_daily_demand * multiplier

        sellable_days: Optional[float] = None
        if adjusted_demand > 0:
            sellable_days = current_stock / adjusted_demand

        warnings: list[str] = []
        level = "OK"
        if sellable_days is None:
            warnings.append(
                "暂无日销数据，暂无法估算可售天数（建议先跑平台模拟产生销售后再评估）"
            )
            level = "INFO"
        elif sellable_days < 5:
            event_txt = "、".join(hits) if hits else "近期"
            deterministic = (
                f"可售天数约 {sellable_days:.1f} 天（< 5），预计在 {event_txt} 前售罄，"
                f"请尽快补货（当前库存 {current_stock}，预计日销 {adjusted_demand:.1f}）"
            )
            warnings.append(deterministic)
            # 有 LLM Key 时，用 Agent 润色预警措辞；失败则回退确定性文案。
            advisory = self._enrich(product_name, deterministic, event_txt, int(sellable_days))
            if advisory:
                warnings[-1] = advisory
            level = "WARN"

        return {
            "productId": inventory.get("productId"),
            "productName": product_name,
            "currentStock": current_stock,
            "dailyDemand": round(avg_daily_demand, 2),
            "adjustedDemand": round(adjusted_demand, 2),
            "eventMultiplier": multiplier,
            "activeEvents": hits,
            "sellableDays": round(sellable_days, 1) if sellable_days is not None else None,
            "level": level,
            "warnings": warnings,
        }

    @staticmethod
    def _enrich(product_name: str, deterministic: str, event_txt: str, sellable_days: int) -> Optional[str]:
        client = get_llm_client()
        if client is None:
            return None
        try:
            system = (
                "你是电商库存运营助手，负责把库存预警写成给商家看的、简洁口语化的一句话提醒，"
                "不超过 40 字，不要重复数据，突出行动建议。"
            )
            user = (
                f"商品「{product_name}」库存预警：{deterministic}。"
                f"相关事件：{event_txt}。请给出一句提醒。"
            )
            resp = client.generate(system=system, user=user, schema=MonitorAdvisory)
            text = resp.advisory.strip()
            return text or None
        except Exception:
            return None
