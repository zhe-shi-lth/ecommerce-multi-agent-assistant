#!/usr/bin/env python3
"""端到端小闭环验证脚本（Task 13 演示数据）。

前置：PostgreSQL / Java(8080) / Python(8000) 三个服务均已启动。
流程：创建 1 商品 + 1 库存 + 1 订单 -> 调 /api/orchestration/generate
      -> 校验 operation_plans 写 1 行、agent_runs 写 5 行（均 SUCCESS）。

使用标准库，无第三方依赖，Windows / Linux 均可直接 `python scripts/demo_e2e.py`。
"""

import json
import sys
import urllib.request
import urllib.error

# Windows 控制台默认 GBK，打印含非 GBK 字符（如异常信息里的箭头）会崩；
# 统一按 UTF-8 输出，避免脚本在中文/异常场景下中断。
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8")
    except Exception:  # noqa: BLE001
        pass

JAVA = "http://localhost:8080"
PYTHON = "http://localhost:8000"


def post_json(url: str, payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_json(url: str) -> object:
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def step(label: str, fn):
    print(f"[*] {label} ...", flush=True)
    try:
        return fn()
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        print(f"    HTTP {e.code}: {body}", file=sys.stderr)
        raise
    except Exception as e:  # noqa: BLE001
        print(f"    ERROR: {e}", file=sys.stderr)
        raise


def main() -> int:
    # 1) 健康检查
    step("health checks", lambda: (
        get_json(f"{PYTHON}/health"),
        get_json(f"{JAVA}/health"),
    ))
    print("    ok: both services up")

    # 2) 造数
    product = step(
        "create product",
        lambda: post_json(
            f"{JAVA}/api/products",
            {
                "name": "Wireless Earbuds",
                "category": "Audio",
                "description": "Budget ANC earbuds",
                "costPrice": 39.0,
                "salePrice": 99.0,
                "targetAudience": "students",
                "usageScenario": "commute",
                "status": "ANALYZED",
            },
        ),
    )
    product_id = product["id"]
    print(f"    product_id={product_id}")

    step(
        "create inventory",
        lambda: post_json(
            f"{JAVA}/api/inventories",
            {
                "productId": product_id,
                "currentStock": 120,
                "reservedStock": 10,
                "safeStockThreshold": 50,
                "purchaseCycleDays": 14,
                "salesLast7Days": 40,
                "inventoryStatus": "ENOUGH",
            },
        ),
    )

    order = step(
        "create order",
        lambda: post_json(
            f"{JAVA}/api/orders",
            {
                "productId": product_id,
                "quantity": 2,
                "status": "PENDING_ANALYSIS",
                "addressComplete": True,
                "paid": True,
                "manualReviewRequired": False,
                "fulfillmentSuggestionStatus": "PENDING_ANALYSIS",
            },
        ),
    )
    order_id = order["id"]
    print(f"    order_id={order_id}")

    # 3) 触发编排（Java 调 Python，Python 再写回 Java）
    result = step(
        "trigger /api/orchestration/generate",
        lambda: post_json(
            f"{JAVA}/api/orchestration/generate",
            {"productId": product_id, "orderId": order_id, "triggerType": "MANUAL"},
        ),
    )
    trace_id = result.get("trace_id")
    print(f"    trace_id={trace_id}")

    # 4) 校验落库
    plans = step(
        "verify operation_plans written",
        lambda: get_json(f"{JAVA}/api/operation-plans/by-trace/{trace_id}"),
    )
    if isinstance(plans, list):
        plan = plans[0]
    else:
        plan = plans
    plan_id = plan["id"]
    assert plan["status"] == "SUCCESS", f"plan status={plan['status']}"
    print(f"    operation_plan id={plan_id} status={plan['status']}")

    runs = step(
        "verify agent_runs written",
        lambda: get_json(f"{JAVA}/api/agent-runs/by-operation-plan/{plan_id}"),
    )
    assert len(runs) == 5, f"expected 5 agent_runs, got {len(runs)}"
    for r in runs:
        assert r["status"] == "SUCCESS", f"agent_run {r['agentName']} status={r['status']}"
    agent_names = ", ".join(r["agentName"] for r in runs)
    print(f"    agent_runs={len(runs)} all SUCCESS: {agent_names}")

    print("\n[OK] 端到端小闭环验证通过：Java↔Python 双向 HTTP 闭环连通，落库正确。")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except Exception as e:  # noqa: BLE001
        print(f"\n[FAIL] 验证失败: {e}", file=sys.stderr)
        sys.exit(1)
