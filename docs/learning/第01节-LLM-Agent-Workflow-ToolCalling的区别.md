# 第 01 节：LLM、Agent、Workflow、Tool Calling 的区别

## 1. 学习目标

本节目标是先把 Agent 项目里最容易混淆的 4 个概念分清楚：

- LLM。
- Agent。
- Workflow。
- Tool Calling。

这几个概念分清楚后，才能理解为什么本项目不是普通聊天机器人，而是一个面向电商运营场景的多 Agent 协同系统。

## 2. LLM 是推理与生成能力，不是完整系统

LLM 是大语言模型，例如 GPT、Claude、DeepSeek、Qwen 等。

LLM 擅长：

- 理解自然语言。
- 生成文本。
- 总结信息。
- 推理判断。
- 生成方案。

LLM 不擅长直接承担：

- 保存业务数据。
- 调用数据库。
- 控制流程状态。
- 保证输出格式稳定。
- 保证执行动作安全。

所以在企业级项目里，LLM 不能单独成为系统。它更像一个推理和生成能力组件。

在本项目中，LLM 可以帮助：

- 生成商品标题。
- 总结商品卖点。
- 生成图片提示词。
- 判断库存风险说明。
- 生成订单履约建议。

但 LLM 不能绕过 Java 系统直接修改业务数据。

## 3. Agent 是有目标、有边界、可执行的智能单元

Agent 不只是调用一次 LLM。

一个 Agent 通常包含：

- 明确目标。
- 输入数据。
- 推理逻辑。
- 可调用工具。
- 结构化输出。
- 错误处理。
- 执行记录。

例如本项目中的 `Inventory & Purchase Agent`，它的目标不是“随便聊库存”，而是：

> 根据当前库存、已占用库存、安全库存、最近销量和采购周期，判断是否需要补货，并输出结构化补货建议。

它的输入包括：

```text
current_stock
reserved_stock
safe_stock_threshold
sales_last_7_days
purchase_cycle_days
```

它的输出包括：

```text
inventory_status
should_restock
suggested_restock_quantity
restock_priority
reason
```

这说明 Agent 是一个职责清晰的业务执行单元，而不是一个泛泛聊天窗口。

## 4. Workflow 是流程编排

Workflow 关注的是：

> 先做什么，后做什么，失败怎么办，什么时候结束。

本项目第一期采用固定 Workflow：

```text
Supervisor Agent
  -> Product Planning Agent
  -> Image Creative Agent
  -> Inventory & Purchase Agent
  -> Order Fulfillment Agent
  -> Supervisor Agent 汇总
```

第一期选择固定 Workflow 的原因：

- 方便理解多 Agent 基础结构。
- 方便调试每个 Agent 的输入输出。
- 方便先打通 Java 与 Python 的服务边界。
- 避免一开始就陷入复杂动态路由。

后续增强时，Supervisor Agent 可以逐步支持：

- 根据输入动态选择 Agent。
- 某个 Agent 失败后重试。
- 某些场景提前终止。
- 高风险场景转人工确认。
- 调用更多工具或外部系统。

这时 Workflow 会逐步演进为 Agentic Workflow。

## 5. Tool Calling 是 Agent 影响真实系统的边界

Tool Calling 是让 Agent 调用外部工具或系统能力。

在本项目中，工具不是随便写的函数，而是 Java 系统暴露出来的业务 API，例如：

```text
GET  /api/tools/products/{productId}
GET  /api/tools/inventories/{productId}
GET  /api/tools/orders/{orderId}
POST /api/tools/agent-runs
POST /api/tools/operation-plans
```

为什么不让 Python Agent 直接连数据库？

因为企业系统中，数据库操作必须经过业务系统控制。Java 侧负责：

- 业务规则。
- 数据校验。
- 状态一致性。
- 审计记录。
- 后续权限控制。

Python Agent 侧负责：

- 判断是否需要调用工具。
- 组织工具调用参数。
- 分析工具返回结果。
- 输出结构化建议。

这样边界更清晰，也更符合企业工程实践。

## 6. 一句话区分

```text
LLM = 推理和生成能力
Agent = 有明确职责的智能执行单元
Workflow = 多个步骤或多个 Agent 的执行流程
Tool Calling = Agent 调用真实系统能力的方式
```

放到本项目里：

```text
LLM 负责生成和判断
Agent 负责完成一个具体运营任务
Workflow 负责组织 5 个 Agent 协作
Tool Calling 负责连接 Java 电商系统
```

## 7. 为什么本项目不是聊天机器人

普通聊天机器人通常是：

```text
用户问一句
模型答一句
```

本项目是：

```text
商品 + 库存 + 订单
  -> 5 个 Agent 分工处理
  -> 输出结构化结果
  -> Java 落库
  -> 可查询、可追踪、可扩展
```

项目重点不是“会聊天”，而是：

- 会拆任务。
- 会协作。
- 会调用工具。
- 会输出结构化结果。
- 会落到企业系统里。
- 能被追踪和复盘。

## 8. 本项目映射

| 理论概念 | 本项目中的对应 |
| --- | --- |
| LLM | 商品文案生成、图片提示词生成、运营建议生成 |
| Agent | Product Planning、Image Creative、Inventory & Purchase、Order Fulfillment |
| Workflow | Supervisor 固定顺序编排 4 个子 Agent |
| Tool Calling | Python 调用 Java Tool API 查询商品、库存、订单并保存执行记录 |
| 结构化输出 | Pydantic Schema 和 OperationPlanResult |
| 可追踪性 | trace_id、operation_plans、agent_runs |

## 9. 小结

第一阶段学习要先建立正确心智：

- 不把 LLM 当系统。
- 不把 Agent 当聊天框。
- 不把 Workflow 当智能本身。
- 不让 Tool Calling 绕过业务系统。

本项目的价值在于：用 Python 多 Agent 组织智能协作，用 Java 系统承载业务事实和执行边界，最终形成一个可落库、可追踪、可演示的电商运营自动化闭环。
