"""Python 调 Java 的 Tool API 客户端（Task 11：双向闭环的写回方向）。

把 SupervisorAgent 生成的运营计划与每个 Agent 的执行记录，通过 Java 侧
REST API 落库：
  - POST /api/operation-plans   写运营计划（返回新建 id）
  - POST /api/agent-runs        写各 Agent 执行记录（关联 operation_plan_id）

Java 的 agent_runs 表中 input_json / output_json 为 NOT NULL，而 Supervisor
默认生成的 run 这两个字段为 None，因此这里统一用 {} 兜底，避免落库失败。
"""

from __future__ import annotations

import os
from typing import Optional
from uuid import uuid4

import httpx
from loguru import logger

from app.schemas.operation_plan import AgentRunRecord, OperationPlanResult

DEFAULT_BASE_URL = "http://localhost:8080"


class JavaApiClient:
    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: float = 30.0,
    ) -> None:
        self.base_url = base_url or os.getenv("JAVA_API_BASE_URL", DEFAULT_BASE_URL)
        self.timeout = timeout

    def persist_operation_plan(
        self, product_id: int, order_id: int, result: OperationPlanResult
    ) -> Optional[int]:
        """把运营计划写入 Java，返回新建的 operation_plan_id；失败返回 None。"""
        url = f"{self.base_url}/api/operation-plans"
        payload = {
            "traceId": result.trace_id,
            "productId": product_id,
            "orderId": order_id,
            # 动态路由可能跳过部分 Agent，对应 plan 为 None -> 落库为 null（Java 侧允许）
            "productPlanJson": result.product_plan.model_dump() if result.product_plan else None,
            "imagePlanJson": result.image_plan.model_dump() if result.image_plan else None,
            "inventoryPlanJson": result.inventory_plan.model_dump() if result.inventory_plan else None,
            "fulfillmentPlanJson": result.fulfillment_plan.model_dump() if result.fulfillment_plan else None,
            "finalSummary": result.final_summary,
            "manualReviewRequired": result.manual_review_required,
            "status": self._plan_status(result),
        }
        try:
            resp = httpx.post(url, json=payload, timeout=self.timeout)
            resp.raise_for_status()
            op_id = resp.json().get("id")
            logger.info(
                "运营计划已落库 Java (id={}, trace={})", op_id, result.trace_id
            )
            return op_id
        except httpx.HTTPError as e:
            logger.error("写入运营计划到 Java 失败 (trace={}): {}", result.trace_id, e)
            return None

    def persist_agent_runs(
        self, operation_plan_id: int, result: OperationPlanResult
    ) -> list[int]:
        """把运营计划下的各 Agent 执行记录写回 Java，返回成功写入的 id 列表。"""
        ids: list[int] = []
        for run in result.agent_runs:
            run_id = self.persist_agent_run(operation_plan_id, run, result.trace_id)
            if run_id is not None:
                ids.append(run_id)
        return ids

    def persist_agent_run(
        self, operation_plan_id: int, run: AgentRunRecord, trace_id: str
    ) -> Optional[int]:
        url = f"{self.base_url}/api/agent-runs"
        payload = {
            "traceId": trace_id,
            "operationPlanId": operation_plan_id,
            "agentName": run.agent_name,
            # Java 侧 NOT NULL，用 {} 兜底
            "inputJson": run.input_json or {},
            "outputJson": run.output_json or {},
            "status": run.status,
            "durationMs": run.duration_ms,
            "errorMessage": run.error_message,
        }
        try:
            resp = httpx.post(url, json=payload, timeout=self.timeout)
            resp.raise_for_status()
            return resp.json().get("id")
        except httpx.HTTPError as e:
            logger.error("写入 agent run 到 Java 失败 ({}): {}", run.agent_name, e)
            return None

    @staticmethod
    def _plan_status(result: OperationPlanResult) -> str:
        # Java 侧 ck_operation_plans_status 只允许 SUCCESS / PARTIAL_FAILED / FAILED
        return "PARTIAL_FAILED" if result.errors else "SUCCESS"

    def create_product(
        self,
        name: str,
        category: str,
        description: str,
        target_audience: str | None = None,
        usage_scenario: str | None = None,
    ) -> Optional[int]:
        """线1上架：先在 Java 侧创建一条商品（DRAFT 状态），返回新建商品 id。"""
        url = f"{self.base_url}/api/products"
        payload = {
            "name": name,
            "category": category,
            "description": description,
            "costPrice": 0,
            "salePrice": 0,
            "targetAudience": target_audience,
            "usageScenario": usage_scenario,
            "status": "DRAFT",
        }
        try:
            resp = httpx.post(url, json=payload, timeout=self.timeout)
            resp.raise_for_status()
            pid = resp.json().get("id")
            logger.info("线1 商品已创建 Java (id={})", pid)
            return pid
        except httpx.HTTPError as e:
            logger.error("线1 创建商品到 Java 失败: {}", e)
            return None

    def persist_line1_plan(
        self,
        product_id: int,
        product_plan: dict,
        image_plan: dict,
        final_summary: str,
    ) -> Optional[int]:
        """线1上架：落库一条仅含商品规划+图片创意的运营计划（无订单、line=LINE1_ONBOARDING）。"""
        url = f"{self.base_url}/api/operation-plans"
        payload = {
            "traceId": f"line1_{uuid4().hex}",
            "productId": product_id,
            "orderId": None,
            "productPlanJson": product_plan,
            "imagePlanJson": image_plan,
            "inventoryPlanJson": {},
            "fulfillmentPlanJson": {},
            "finalSummary": final_summary,
            "manualReviewRequired": False,
            "status": "SUCCESS",
            "line": "LINE1_ONBOARDING",
        }
        try:
            resp = httpx.post(url, json=payload, timeout=self.timeout)
            resp.raise_for_status()
            op_id = resp.json().get("id")
            logger.info("线1 运营计划已落库 Java (id={})", op_id)
            return op_id
        except httpx.HTTPError as e:
            logger.error("线1 落库运营计划到 Java 失败: {}", e)
            return None
