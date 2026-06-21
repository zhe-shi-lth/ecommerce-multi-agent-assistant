# 第 16 节：Workflow 偏离、错误出口与多级降级

## 1. 学习目标

本节目标是理解错误链路设计：当执行过程偏离预设 workflow 时，不应该统一报错，也不应该让 Agent 随意回复，而是识别偏离位置，进入对应错误出口。

核心思想：

```text
错误处理不是统一抛错
而是根据 workflow 偏离位置进入对应降级出口
并返回可修正、可追踪、可定位的原因
```

## 2. 什么是 Workflow 偏离

第一期 workflow：

```text
Java 准备 Product + Inventory + Order
  -> 调用 Python Supervisor
  -> Product Planning Agent
  -> Image Creative Agent
  -> Inventory & Purchase Agent
  -> Order Fulfillment Agent
  -> Supervisor 汇总
  -> Java 保存 operation_plans 和 agent_runs
```

只要某一步没有按预期发生，就是 workflow 偏离。

例如：

- Product 缺少 name。
- Inventory 缺失。
- Order quantity <= 0。
- Agent 输出缺字段。
- Python 返回格式 Java 解析不了。
- Java 保存 `operation_plans` 失败。

## 3. 为什么不能统一报错

统一报错通常是：

```text
系统异常，请稍后重试。
```

这不能告诉用户：

- 是不是自己填错了？
- 是不是库存没有初始化？
- 是不是订单状态不对？

也不能告诉开发者：

- 是 Java 出错？
- 是 Python 出错？
- 是哪个 Agent 出错？
- 是 Schema 错？
- 是 Tool API 错？
- 是数据库保存错？

## 4. 错误出口的概念

错误出口是：

> 系统在某类错误发生时，不继续假装成功，而是进入明确的处理分支。

常见出口：

```text
输入不合法 -> 输入修正出口
业务风险 -> 人工确认出口
Agent 输出不合法 -> Agent 降级出口
Tool API 失败 -> 工具失败出口
Java 落库失败 -> 持久化失败出口
```

## 5. 输入修正出口

适用于用户输入或基础数据不完整。

例如：

- 商品名称为空。
- 销售价为空。
- 销售价低于成本价。
- 库存未初始化。
- 订单数量小于等于 0。

返回示例：

```json
{
  "status": "FAILED",
  "error_type": "INPUT_INVALID",
  "stage": "JAVA_VALIDATION",
  "message": "商品名称不能为空，请补充商品名称后重新生成运营建议。",
  "user_action": "请修正商品基础信息。",
  "developer_action": null
}
```

## 6. 业务风险出口

适用于业务本身有风险，但系统没有坏。

例如：

- 订单未付款。
- 地址不完整。
- 库存不足。
- 补货数量异常大。
- 图片提示词存在风险。

这类不应返回“系统异常”，而应返回需要人工确认。

## 7. Agent 输出异常出口

适用于 Agent 没有按 Schema 输出。

处理策略：

```text
第一次：尝试修复或重试
第二次：降级为模板输出
仍失败：记录错误，标记 PARTIAL_FAILED
```

返回示例：

```json
{
  "status": "PARTIAL_FAILED",
  "error_type": "AGENT_SCHEMA_INVALID",
  "stage": "INVENTORY_PURCHASE_AGENT",
  "message": "库存 Agent 输出缺少 should_restock 字段，已使用规则模板降级。",
  "user_action": "请查看降级后的补货建议。",
  "developer_action": "请检查 Inventory & Purchase Agent 的输出 Schema 或 Prompt。"
}
```

## 8. 工具调用失败出口

适用于 Python 调 Java Tool API 失败。

例如：

- `/api/tools/inventories/{productId}` 返回 404。
- `/api/tools/agent-runs` 返回 500。
- Java Tool API 超时。

返回应区分用户修正和开发修复：

```json
{
  "status": "FAILED",
  "error_type": "TOOL_API_FAILED",
  "stage": "PYTHON_TOOL_CLIENT",
  "message": "调用库存查询工具失败，无法获取商品库存数据。",
  "user_action": "请确认商品是否已初始化库存。",
  "developer_action": "请检查 /api/tools/inventories/{productId} 接口和 Java 服务日志。"
}
```

## 9. 持久化失败出口

适用于 Java 保存失败。

例如：

- `operation_plans` 保存失败。
- `agent_runs` 保存失败。
- 数据库连接异常。
- JSON 字段格式异常。

这类错误意味着分析可能完成了，但结果没有可靠保存。

## 10. Workflow 中断出口

Supervisor 要判断哪些失败可以继续，哪些必须中断。

建议规则：

```text
内容类 Agent 失败 -> 可降级继续
库存/订单类 Agent 失败 -> 转人工或中断
Supervisor 自身失败 -> 整体失败
```

## 11. 多级降级策略

一级降级：重试。

适合：

- LLM 输出格式错误。
- 临时网络抖动。
- 短暂超时。

二级降级：模板 / 规则兜底。

适合：

- Product Planning Agent。
- Image Creative Agent。
- Inventory reason 生成失败。

三级降级：人工确认 / 中断。

适合：

- 库存数据缺失。
- 订单状态异常。
- 履约判断失败。
- Tool API 连续失败。
- 持久化失败。

总结：

```text
能重试就重试
能模板兜底就兜底
有业务风险就转人工
无法保证结果可信就中断
```

## 12. 结构化错误对象

后续建议设计：

```json
{
  "code": "AGENT_SCHEMA_INVALID",
  "stage": "INVENTORY_PURCHASE_AGENT",
  "message": "库存 Agent 输出缺少 should_restock 字段。",
  "user_action": "请查看降级建议或转人工确认。",
  "developer_action": "请检查 Agent 输出 Schema。",
  "recoverable": true,
  "manual_review_required": true
}
```

错误也要 Schema 化，不要只保存一段字符串。

## 13. 第一阶段错误类型

可以先定义：

```text
INPUT_INVALID
BUSINESS_RISK
AGENT_FAILED
AGENT_SCHEMA_INVALID
TOOL_API_FAILED
PYTHON_SERVICE_FAILED
JAVA_CLIENT_FAILED
PERSISTENCE_FAILED
WORKFLOW_INTERRUPTED
UNKNOWN_ERROR
```

每个错误都要带：

```text
stage
code
message
user_action
developer_action
manual_review_required
recoverable
```

## 14. 面试表达

可以这样讲：

> 我没有把 Agent 错误统一处理成“系统异常”，而是按照 workflow 节点设计了错误出口。系统会区分输入不合法、业务风险、Agent 输出结构异常、Tool API 调用失败、Python 服务失败和 Java 落库失败。不同错误会进入不同降级策略：内容类 Agent 可以模板兜底，库存和履约类 Agent 失败则转人工确认，持久化失败则中断并提示开发根据 trace_id 排查。错误本身也结构化返回，包含 stage、code、user_action 和 developer_action。

## 15. 小结

错误处理不是统一报错，而是 workflow 偏离后的分流系统。

每类错误都要有明确出口、降级策略、用户修正建议和开发定位信息。Agent 系统不能随意回复，也不能糊成一个异常。
