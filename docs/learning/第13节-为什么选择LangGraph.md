# 第 13 节：为什么选择 LangGraph

## 1. 学习目标

本节目标是理解为什么本项目 Python 侧选择 LangGraph，而不是只手写流程、优先用 AutoGen 或使用普通 Chain。

## 2. 本项目是有状态流程

第一期流程是：

```text
Product + Inventory + Order
  -> Supervisor Agent
  -> Product Planning Agent
  -> Image Creative Agent
  -> Inventory & Purchase Agent
  -> Order Fulfillment Agent
  -> Supervisor 汇总
  -> OperationPlanResult
```

特点：

- 多个步骤。
- 多个 Agent。
- 有共享执行状态。
- 每一步有输入输出。
- 最终要汇总。
- 后续可能加条件路由、失败重试和人工确认。

这类系统适合用图表达。

## 3. LangGraph 的三个核心概念

### 3.1 State

State 是流程中传递的数据。

本项目 State 可以包含：

```text
trace_id
product
inventory
order
product_plan
image_plan
inventory_plan
fulfillment_plan
manual_review_required
errors
```

### 3.2 Node

Node 是执行步骤。

每个 Agent 或流程步骤都可以是节点：

```text
init_context_node
product_planning_node
image_creative_node
inventory_purchase_node
order_fulfillment_node
summary_node
```

### 3.3 Edge

Edge 决定执行顺序。

第一期固定：

```text
START
  -> product_planning
  -> image_creative
  -> inventory_purchase
  -> order_fulfillment
  -> summary
  -> END
```

后续可扩展条件边。

## 4. 为什么不直接手写 if-else

第一期手写流程也可以，但后续复杂后会出现：

- 条件路由。
- Agent 失败重试。
- 跳过某个 Agent。
- 人工确认节点。
- 中断和恢复。
- 多分支执行。
- 知识库检索节点。

手写会变成大量 `if/elif/try/except`。

LangGraph 让流程结构显式化：

```text
有哪些节点
节点怎么连接
状态怎么流动
哪里可以分支
哪里结束
```

## 5. 第一阶段怎么用 LangGraph

第一期不要一开始使用复杂能力，只需要表达固定流程：

```text
Product Planning
-> Image Creative
-> Inventory & Purchase
-> Order Fulfillment
-> Summary
```

第一期目标：

- 熟悉 State / Node / Edge。
- 跑通 5 Agent。
- 输出 OperationPlanResult。

## 6. LangGraph 和 Pydantic 的关系

Pydantic 定义数据契约：

```text
ProductContext
InventoryContext
OrderContext
ProductPlan
ImagePlan
InventoryPlan
FulfillmentPlan
OperationPlanResult
```

LangGraph 定义流程编排。

可以理解为：

```text
Pydantic = 数据契约
LangGraph = 流程编排
```

## 7. LangGraph 和 Supervisor 的关系

第一期 Supervisor 可以拆成两部分：

流程编排：

```text
由 LangGraph 按顺序执行节点
```

结果汇总：

```text
由 summary node 汇总 product_plan、image_plan、inventory_plan、fulfillment_plan
```

后续再增强动态路由、失败恢复和人工确认节点。

## 8. 为什么不优先用 AutoGen

AutoGen 更偏多 Agent 对话协作，适合 Agent 之间互相交流、讨论、分工。

第一期我们更需要：

```text
固定流程
职责边界清晰
结构化输出
可追踪
可落库
```

LangGraph 更适合显式流程编排。

## 9. 为什么不用普通 Chain

普通 Chain 更适合简单线性调用。

本项目后续会有：

- 条件路由。
- 分支。
- 重试。
- 人工确认。
- 中断恢复。
- 多 Agent 状态流转。

这些更适合图模型。

## 10. 面试表达

可以这样讲：

> 我选择 LangGraph 是因为项目本质上是一个有状态的多 Agent 工作流，而不是简单的一次性 LLM 调用。每个 Agent 都可以映射为图中的节点，商品、库存、订单和各 Agent 的结构化输出都保存在状态中，节点之间通过边按流程流转。第一期我先用 LangGraph 实现固定顺序编排，保证流程可控、可测试、可追踪；后续再逐步加入条件路由、失败重试和人工确认节点。

## 11. 小结

LangGraph 适合本项目，因为多 Agent 系统本质上是有状态工作流。

Pydantic 定义数据契约，LangGraph 定义流程编排。
