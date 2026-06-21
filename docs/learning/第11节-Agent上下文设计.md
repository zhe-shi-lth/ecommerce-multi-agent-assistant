# 第 11 节：Agent 上下文设计

## 1. 学习目标

本节目标是理解多 Agent 系统中的上下文如何设计，以及为什么不是给 Agent 的信息越多越好。

## 2. 上下文不是越多越好

上下文太多会导致：

- Token 变多，成本变高。
- 重点变模糊。
- Agent 忽略关键字段。
- 输出不稳定。
- 调试困难。

每个 Agent 应该拿到刚好够用的上下文。

## 3. 本项目上下文分三类

### 3.1 业务事实上下文

来自 Java，可信度最高：

```text
Product
Inventory
Order
trigger_type
```

这些是数据库事实。

### 3.2 Agent 中间结果上下文

来自 Agent 输出：

```text
Product Planning Agent 输出 selling_points
Image Creative Agent 使用 selling_points
Inventory Agent 输出库存风险
Order Agent 输出履约风险
```

这些是 Agent 判断结果。

### 3.3 执行控制上下文

由 Supervisor 管理：

```text
trace_id
当前执行到哪个 Agent
是否有错误
是否需要人工确认
每个 Agent 的执行状态
```

## 4. 业务事实和 Agent 判断必须分开

例如库存事实：

```text
current_stock = 18
reserved_stock = 5
safe_stock_threshold = 20
```

Agent 判断：

```text
inventory_status = RISK
should_restock = true
restock_priority = HIGH
```

事实来自数据库，判断来自 Agent。两者不能混在一起。

## 5. Supervisor 是上下文管理员

Supervisor 负责：

- 保存原始上下文。
- 判断每个 Agent 需要什么输入。
- 收集每个 Agent 输出。
- 决定哪些输出传给后续 Agent。
- 汇总最终结果。

子 Agent 不直接修改原始业务事实。

## 6. 子 Agent 不应随便改上下文

第一期规则：

```text
子 Agent 只读输入上下文
子 Agent 只输出自己的结果
Supervisor 负责汇总
Java 负责最终保存
```

这能避免上下文污染。

## 7. 上下文设计影响职责边界

Image Creative Agent 不需要订单和库存完整信息。

它需要：

```text
Product
ProductPlan.selling_points
target_audience
usage_scenario
```

Inventory & Purchase Agent 不需要图片提示词。

它需要：

```text
Inventory
Order.quantity
```

给 Agent 什么，它就容易做什么。因此上下文设计就是职责边界设计。

## 8. 上下文要结构化

不要传一大段自然语言：

```text
商品是便携榨汁杯，库存 18，订单买了 2 个，你帮我看看。
```

应该传结构化 JSON：

```json
{
  "product": {
    "name": "便携式榨汁杯",
    "category": "小家电"
  },
  "inventory": {
    "current_stock": 18,
    "reserved_stock": 5
  },
  "order": {
    "quantity": 2,
    "paid": true
  }
}
```

## 9. 第一阶段上下文传递建议

Supervisor 输入：

```text
ProductContext
InventoryContext
OrderContext
trigger_type
```

Product Planning Agent 输入：

```text
ProductContext
```

Image Creative Agent 输入：

```text
ProductContext
ProductPlan.selling_points
ProductPlan.target_user_summary
```

Inventory & Purchase Agent 输入：

```text
InventoryContext
OrderContext.quantity
```

Order Fulfillment Agent 输入：

```text
OrderContext
InventoryContext.current_stock
InventoryContext.reserved_stock
```

## 10. 面试表达

可以这样讲：

> 在多 Agent 协同里，我没有把所有数据都无差别传给每个 Agent，而是把上下文分成业务事实、Agent 中间结果和执行控制信息三类。Java 提供 Product、Inventory、Order 作为可信业务事实，Supervisor 负责上下文分发和汇总。每个子 Agent 只拿完成自己任务所需的最小上下文，并输出结构化结果。

## 11. 小结

上下文设计决定 Agent 能不能稳定工作。

不是信息越多越好，而是要给 Agent 刚好完成职责所需的信息。
