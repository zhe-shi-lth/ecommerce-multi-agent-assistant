# 第 07 节：Java 与 Python 职责边界

## 1. 学习目标

本节目标是理解 Java 和 Python 在本项目中的分层关系。

项目架构是：

```text
Python 多 Agent 协同层 + Java 电商业务系统载体
```

边界不清，项目后续会变乱。

## 2. 一句话边界

```text
Java 负责业务事实和执行边界
Python 负责智能协同和运营判断
```

也可以理解为：

```text
Java = 电商业务系统
Python = 多 Agent 智能协调系统
```

## 3. Java 负责什么

Java 负责稳定、确定、需要一致性的内容：

- 商品数据。
- 库存数据。
- 订单数据。
- 运营建议落库。
- Agent 执行记录落库。
- API 契约。
- 数据校验。
- 状态保存。
- 后续权限控制。
- 后续事务控制。
- 后续审计能力。

对应数据表：

```text
products
inventories
orders
operation_plans
agent_runs
```

这些是业务事实和执行记录，应由 Java 主系统管理。

## 4. Python 负责什么

Python 负责智能分析、协同和生成：

- Supervisor 编排。
- Product Planning Agent。
- Image Creative Agent。
- Inventory & Purchase Agent。
- Order Fulfillment Agent。
- Pydantic Schema。
- Agent 输出结构化。
- 后续调用 LLM。
- 调用 Java Tool API。
- 汇总 OperationPlanResult。

Python 根据业务事实生成判断和建议，不绕过 Java 修改业务事实。

## 5. 为什么 Java 不直接做所有 Agent

Java 也可以调用 LLM，但 Python 更适合 Agent 层：

- LangGraph、LangChain 生态成熟。
- Pydantic 做结构化输出方便。
- AI SDK 和模型适配丰富。
- 原型迭代快。
- 多 Agent 编排案例多。

Java 更适合业务系统层：

- Spring Boot 企业开发成熟。
- 数据库访问、事务、接口、校验强。
- 企业系统中 Java 后端常见。

## 6. 为什么不全用 Python

项目目标是体现：

```text
AI Agent 如何接入传统企业系统
```

如果全部用 Python，就弱化了 Java 业务系统集成价值。

本项目需要体现 Java 工程能力和 Python Agent 能力的结合。

## 7. Java 调 Python

用户触发：

```text
POST /api/operation-plans
```

Java 做：

1. 查询商品。
2. 查询库存。
3. 查询订单。
4. 组装 Agent 请求。
5. 调用 Python：

```text
POST /agent/ecommerce/operation-plan
```

Python 返回 `OperationPlanResult`，Java 保存结果。

## 8. Python 调 Java

Python 通过 Tool API 使用 Java 能力：

```text
GET  /api/tools/products/{productId}
GET  /api/tools/inventories/{productId}
GET  /api/tools/orders/{orderId}
POST /api/tools/operation-plans
POST /api/tools/agent-runs
```

这说明 Java 是业务主系统，Python 通过工具接口协作。

## 9. 谁负责状态流转

Agent 可以建议：

```text
next_order_status = READY_TO_SHIP
```

但真正保存状态的是 Java。

原则：

```text
Python 给建议
Java 做落库
```

涉及真实扣库存、发货、退款时，必须由 Java 控制。

## 10. 边界混乱的反例

错误设计：

```text
Python 直接连 PostgreSQL 修改订单状态
```

问题：

- 绕过 Java 校验。
- 事务边界混乱。
- 权限不好做。
- 审计不好做。

错误设计：

```text
Java 和 Python 都保存 operation_plans
```

问题：

- 数据来源不清。
- 重复写入。
- 状态不一致。

正确设计：

```text
Python 生成 OperationPlanResult
Java 保存 OperationPlanResult
```

## 11. 面试表达

可以这样讲：

> 我把 Java 和 Python 做了明确分层。Java 是电商业务主系统，负责商品、库存、订单、运营建议和 Agent 执行记录的持久化，也负责业务校验和后续事务、权限扩展。Python 是多 Agent 协同层，负责 Supervisor 编排、商品运营、图片创意、库存补货和订单履约判断。Python Agent 不直接操作数据库，而是通过 Java Tool API 使用业务能力；Java 通过统一 Agent API 触发 Python 分析，并保存结构化结果。

## 12. 小结

Java 是业务主系统，Python 是智能协同层。

Java 管数据、状态、校验和落库；Python 管 Agent 编排、推理、生成和工具调用。两者通过 HTTP API 协作。
