# 第 04 节：Tool Calling 与企业系统边界

## 1. 学习目标

本节目标是理解 Tool Calling 为什么是 Agent 从“会说”走向“能做”的关键，以及为什么企业系统中的工具调用必须受控。

在本项目中，Tool Calling 主要体现为 Python Agent 调用 Java 电商系统暴露的 Tool API。

## 2. 没有 Tool Calling 的 Agent 只能给建议

如果 Agent 只能生成文本，它最多能做到：

```text
建议补货 50 件。
建议该订单可以出货。
建议商品标题改成某某。
```

但企业系统还需要：

- 查询商品。
- 查询库存。
- 查询订单。
- 保存运营建议。
- 保存 Agent 执行记录。

这些动作必须通过工具调用完成。

## 3. Tool Calling 不是让 Agent 随便操作系统

第一期给 Python Agent 的工具是受控的：

```text
GET  /api/tools/products/{productId}
GET  /api/tools/inventories/{productId}
GET  /api/tools/orders/{orderId}
POST /api/tools/operation-plans
POST /api/tools/agent-runs
```

Agent 不能：

- 直接删除商品。
- 直接修改价格。
- 直接退款。
- 直接扣库存。
- 直接操作数据库。

## 4. Python Agent 不直接连数据库

虽然 Python 可以直接连接 PostgreSQL，但本项目不这么做。

原因是业务主权在 Java。

Java 负责：

- 数据校验。
- 事务控制。
- 状态流转。
- 审计记录。
- 后续权限控制。
- 数据一致性。

Python Agent 负责：

- 理解任务。
- 组织上下文。
- 调用工具。
- 生成判断。
- 输出结构化结果。

正确边界是：

```text
Python Agent 不直接操作数据库
Python Agent 通过 Java Tool API 使用业务能力
```

## 5. Tool 可以理解成 Agent 的手

LLM 像大脑，Workflow 像流程安排，Tool Calling 像手。

没有工具，Agent 只能想和说。

有工具，Agent 才能查、写、触发流程。

## 6. Tool Calling 的输入输出也要结构化

查询库存工具返回应是结构化数据：

```json
{
  "product_id": 1001,
  "current_stock": 18,
  "reserved_stock": 5,
  "safe_stock_threshold": 20,
  "purchase_cycle_days": 5,
  "sales_last_7_days": 32,
  "inventory_status": "LOW"
}
```

Java 返回的数据越稳定，Agent 判断越可靠。

## 7. Tool Calling 与普通 API 调用的区别

普通 API 调用是业务代码明确知道要调哪个接口。

Agent Tool Calling 是 Agent 根据任务和上下文决定是否使用某个工具。

第一期工具调用比较固定，后续可以增强为：

- 是否查询历史订单。
- 是否查询商品表现数据。
- 是否查询库存趋势。
- 是否触发通知。

## 8. Tool Calling 必须可追踪

企业项目中，工具调用不能悄悄发生。

至少要能知道：

- 哪个 `trace_id`。
- 哪个 Agent。
- 调用了什么工具。
- 输入参数是什么。
- 返回结果是什么。
- 有没有失败。

第一期先记录 Agent 级别的 `agent_runs`，后续再考虑更细的 `tool_runs`。

## 9. 第一阶段策略

第一期 Tool Calling 策略：

```text
少工具
低风险
结构化
可追踪
Java 控制业务边界
Python 控制 Agent 协同
```

第一期只做查询和保存建议，不做真实发货、退款、扣库存、图片生成。

## 10. 面试表达

可以这样讲：

> 在我的项目中，Python Agent 不直接操作数据库，而是通过 Java 暴露的 Tool API 访问业务能力。Java 作为业务主系统，负责商品、库存、订单、运营建议和执行记录的保存，也负责后续校验、事务和权限。Python Agent 负责根据上下文选择工具、组织参数、分析工具返回结果，并输出结构化建议。

## 11. 小结

Tool Calling 是 Agent 从“会说”走向“能做”的关键。

但企业系统中的工具调用必须受控：工具由 Java 暴露，Agent 通过 API 调用，所有结果结构化、可记录、可追踪。
