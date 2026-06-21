# 第 18 节：Python Agent 服务目录结构说明

## 1. 学习目标

本节目标是帮助 Java 工程师先理解 Python Agent 服务的项目路径和文件职责。

第一阶段不要求深入 Python 语法细节，但必须知道：

- 每个目录放什么。
- 请求进来后经过哪些文件。
- Agent 代码未来放在哪里。
- 出问题时应该看哪个位置。

## 2. 当前 Python 服务根目录

```text
python-agent-service/
```

这是 Python Agent 服务的根目录。

可以类比为 Java 中一个独立的 Spring Boot 子项目，例如：

```text
java-service/
```

后续 Python 多 Agent、FastAPI 接口、Pydantic Schema、LangGraph 编排都会放在这里。

## 3. pyproject.toml

```text
python-agent-service/pyproject.toml
```

作用类似 Java 项目里的 `pom.xml`。

它负责：

- 声明项目名称。
- 声明 Python 版本要求。
- 管理依赖。
- 配置 pytest。

当前确认的主要依赖：

- FastAPI：HTTP 服务框架。
- Pydantic v2：结构化输入输出模型。
- LangGraph：后续多 Agent Workflow 编排。
- LangChain 基础包：后续 LLM 能力基础。
- HTTPX：调用 Java Tool API。
- pytest：测试框架。
- loguru：日志工具。

## 4. app/main.py

```text
python-agent-service/app/main.py
```

作用类似 Spring Boot 的启动入口，同时也暂时包含最小健康检查接口。

当前职责：

- 创建 FastAPI 应用。
- 暴露 `/health` 接口。
- 让 `/docs` OpenAPI 文档可访问。

后续职责：

- 注册 API 路由。
- 不直接写复杂业务逻辑。
- 不直接写 Agent 编排。

Java 类比：

```text
Application.java + 最小 Controller 注册入口
```

## 5. app/api

```text
python-agent-service/app/api/
```

作用类似 Java 的 Controller 层。

后续会放：

```text
POST /agent/ecommerce/operation-plan
```

这个接口用于 Java 调用 Python 多 Agent 服务。

原则：

- 只处理 HTTP 请求和响应。
- 不直接写复杂 Agent 逻辑。
- 具体编排交给 `services/`。

## 6. app/schemas

```text
python-agent-service/app/schemas/
```

作用类似 Java 的 DTO、Request、Response。

后续会放：

- `ProductContext`
- `InventoryContext`
- `OrderContext`
- `ProductPlan`
- `ImagePlan`
- `InventoryPlan`
- `FulfillmentPlan`
- `OperationPlanRequest`
- `OperationPlanResult`

它是 Python Agent 服务里非常重要的一层。

原因：

- 约束 Java 发来的请求。
- 约束 Agent 输出。
- 约束 Python 返回给 Java 的响应。
- 支撑测试和错误校验。

## 7. app/agents

```text
python-agent-service/app/agents/
```

放 5 个 Agent 的具体实现。

后续文件：

```text
supervisor_agent.py
product_planning_agent.py
image_creative_agent.py
inventory_purchase_agent.py
order_fulfillment_agent.py
```

每个 Agent 负责一个明确业务职责。

第一期先用规则和模板实现，不急着接真实 LLM。

## 8. app/services

```text
python-agent-service/app/services/
```

作用类似 Java 的 Service 层。

后续会放：

- Supervisor 编排服务。
- LangGraph Workflow 构建。
- 多 Agent 调用流程。

它负责组织多个 Agent，不负责保存数据库，也不直接处理 HTTP。

## 9. app/tools

```text
python-agent-service/app/tools/
```

作用类似 Java 中调用外部系统的 Client。

后续会放：

```text
java_api_client.py
```

用于调用 Java Tool API：

```text
GET  /api/tools/products/{productId}
GET  /api/tools/inventories/{productId}
GET  /api/tools/orders/{orderId}
POST /api/tools/operation-plans
POST /api/tools/agent-runs
```

原则：

- Python 不直接连 PostgreSQL。
- Python 只通过 Java Tool API 使用业务能力。

## 10. app/tracing

```text
python-agent-service/app/tracing/
```

后续放 trace 和执行记录相关辅助逻辑。

可能包括：

- 创建 `trace_id`。
- 记录 Agent 执行时间。
- 组织 `AgentRunRecord`。
- 统一错误记录。

第一期先保持空目录，后续做 Agent 执行记录时再补充。

## 11. tests

```text
python-agent-service/tests/
```

作用类似 Java 的 `src/test`。

当前已有：

```text
tests/test_main.py
```

用于验证：

- FastAPI 应用可以导入。
- `/health` 接口返回服务状态。

后续会增加：

- Schema 测试。
- 单 Agent 测试。
- Supervisor Workflow 测试。
- API 测试。
- Java Tool Client 测试。

## 12. 当前请求链路

当前最小链路：

```text
HTTP GET /health
  -> app/main.py
  -> health_check()
  -> 返回服务状态
```

后续目标链路：

```text
Java 调 POST /agent/ecommerce/operation-plan
  -> app/api/operation_plan.py
  -> app/services/ 编排 Supervisor Workflow
  -> app/agents/ 执行 5 个 Agent
  -> app/tools/ 按需调用 Java Tool API
  -> app/schemas/ 校验结构化输出
  -> 返回 OperationPlanResult
```

## 13. 小结

当前 Python Agent 服务目录可以按 Java 思维这样理解：

| Python 路径 | Java 类比 | 作用 |
| --- | --- | --- |
| `pyproject.toml` | `pom.xml` | 依赖和项目配置 |
| `app/main.py` | `Application.java` / 入口 | 创建 FastAPI 应用 |
| `app/api/` | Controller | HTTP 接口 |
| `app/schemas/` | DTO | 请求响应和 Agent 输出模型 |
| `app/agents/` | 业务执行单元 | 5 个 Agent 实现 |
| `app/services/` | Service | 编排流程 |
| `app/tools/` | 外部服务 Client | 调用 Java Tool API |
| `app/tracing/` | Trace / 审计辅助 | trace_id 和执行记录 |
| `tests/` | `src/test` | 自动化测试 |

第一期学习 Python 代码时，不需要先钻语法细节。先看懂目录职责和请求流转，再逐步理解每个文件的实现。
