"""线2 库存监控 Agent：基于实际日销 + LLM 判断的「未来事件」估算可售天数。

这是线2（监控类型）的核心智能：
- 发布前审核（确定性 DB 校验）由 Java 端完成，本 Agent 不负责。
- 本 Agent 负责"销售监控"页的**智能预警**：按真实日销估算可售天数，
  并叠加"未来 30 天内可能推高销量的事件"（由 LLM 依据日期、库存、已知节日/促销
  判断，不再写死日历）上调未来需求；可售天数 < 5 天则判定为预警（红线兜底）。

设计要点：
- 红线式兜底：可售天数 < 5 天一律 WARN，不依赖 LLM。
- LLM 只升不降：事件倍率 >= 1.0，只可能让预警更早/更多，绝不削弱红线。
- 无 LLM Key 时，退化为纯红线式警告（事件倍率=1.0），不依赖外部模型。
"""

from datetime import date, timedelta
from typing import Optional

from pydantic import BaseModel

from app.llm.client import get_monitor_llm_client


class _UpcomingEvent(BaseModel):
    name: str
    date: str  # YYYY-MM-DD
    multiplier: float  # 该事件的需求倍率，>= 1.0


class EventJudgment(BaseModel):
    events: list[_UpcomingEvent]
    multiplier: float  # 整体需求倍率（取最大影响），>= 1.0
    notes: str


class MonitorAdvisory(BaseModel):
    advisory: str


def _judge_events(
    reference: date, current_stock: int, avg_daily_demand: float, product_name: str
) -> tuple[float, list[str]]:
    """调用 LLM 判断未来 30 天内可能推高需求的事件与倍率。

    返回 (倍率, 事件名列表)。无 LLM 或失败时返回 (1.0, [])（纯红线兜底）。
    倍率被钳制在 [1.0, 5.0]，保证"只升不降"且不会离谱。
    """
    client = get_monitor_llm_client()
    if client is None:
        return 1.0, []
    try:
        system = (
            "你是电商库存运营助手，负责判断未来 30 天内可能推高某商品销量的事件"
            "（如 618 大促、双11、双12、年货节/春节、国庆黄金周、七夕、情人节、"
            "平台或品类大促等真实存在的节日或促销），并给出整体需求上调倍率（>=1.0，无则 1.0）。"
            "不要编造不存在的促销；只考虑未来，不考虑过去。"
        )
        user = (
            f"今天是 {reference.isoformat()}。商品「{product_name}」当前可用库存约 {current_stock} 件，"
            f"近 7 日日均销量约 {avg_daily_demand:.1f} 件。"
            f"请判断未来 30 天内可能推高需求的事件及各自倍率，并给出整体需求倍率（取最大影响，>=1.0）。"
            f"以 EventJudgment 结构返回。"
        )
        resp = client.generate(system=system, user=user, schema=EventJudgment)
        mult = max(1.0, min(float(resp.multiplier), 5.0))
        hits: list[str] = []
        for ev in resp.events:
            m = max(1.0, min(float(ev.multiplier), 5.0))
            hits.append(f"{ev.name}({ev.date},×{m:.1f})")
        return mult, hits
    except Exception:
        return 1.0, []


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

        # 事件智能：由 LLM 判断未来事件并给出需求倍率（红线兜底、只升不降）。
        multiplier, hits = _judge_events(reference, current_stock, avg_daily_demand, product_name)
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
        client = get_monitor_llm_client()
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
