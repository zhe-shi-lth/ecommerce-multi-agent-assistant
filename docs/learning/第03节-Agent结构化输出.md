# 第 03 节：Agent 结构化输出

## 1. 学习目标

本节目标是理解为什么企业级 Agent 不能只返回自然语言，而必须返回稳定的结构化结果。

在本项目中，结构化输出是 Java 系统消费 Agent 结果、数据库落库、测试验证和后续页面展示的基础。

## 2. 自然语言适合人看，结构化输出适合系统用

自然语言适合表达解释，例如：

```text
这个商品库存偏低，建议尽快补货。
```

但 Java 系统更需要明确字段：

```json
{
  "inventory_status": "RISK",
  "should_restock": true,
  "suggested_restock_quantity": 50,
  "restock_priority": "HIGH",
  "reason": "可用库存低于安全库存，最近销量较高，采购周期较长，存在断货风险。"
}
```

结构化结果可以被：

- Java DTO 解析。
- 数据库保存。
- 前端展示。
- 测试断言。
- Supervisor 汇总。
- 后续 Agent 继续使用。

## 3. 结构化输出是 Agent 和 Java 之间的契约

可以把 Agent 输出 Schema 理解成 Java 接口 DTO。

Java 后端不会让接口随便返回一段字符串，Python Agent 也不应该随便返回自然语言。

例如库存 Agent 的输出契约可以用 Pydantic 表达：

```python
class InventoryPlan(BaseModel):
    inventory_status: str
    should_restock: bool
    suggested_restock_quantity: int
    restock_priority: str
    reason: str
```

这表示 Agent 必须按这个结构交付结果。

## 4. 多 Agent 更需要结构化输出

多 Agent 中，一个 Agent 的输出可能成为另一个 Agent 的输入。

例如：

```text
Product Planning Agent 输出 selling_points
Image Creative Agent 使用 selling_points 生成图片提示词
Supervisor 汇总所有 Agent 输出
Java 保存 OperationPlanResult
```

如果字段名不稳定，比如一会儿叫 `selling_points`，一会儿叫 `features`，后续 Agent 和 Java 都会出问题。

所以结构化输出不是锦上添花，而是多 Agent 协同的基础设施。

## 5. 本项目中的结构化输出层级

第一层：单个 Agent 输出。

```text
ProductPlan
ImagePlan
InventoryPlan
FulfillmentPlan
```

第二层：Supervisor 汇总输出。

```text
OperationPlanResult
```

第三层：Java 落库结构。

```text
operation_plans
agent_runs
```

链路是：

```text
Agent 输出
  -> Supervisor 汇总
  -> Java 接收
  -> 数据库保存
  -> 用户查询
```

## 6. 结构化不等于死板

结构化只规定输出形状，不限制推理内容。

例如 `reason` 字段仍然可以包含智能解释：

```text
可用库存为 13，低于安全库存 20，且最近 7 天销量为 32，采购周期为 5 天，因此建议高优先级补货。
```

稳定字段 + 智能内容，才适合企业系统。

## 7. 第一阶段策略

第一期即使先用规则和模板实现 Agent，也必须严格输出 Schema。

第一阶段重点：

- 5 个 Agent 都能稳定输出结构化结果。
- Supervisor 能稳定汇总。
- Java 能稳定保存。
- 测试能稳定断言。

## 8. 面试表达

可以这样讲：

> 我没有让 Agent 只返回自然语言，而是为每个 Agent 定义了 Pydantic Schema。每个 Agent 输出都必须经过结构化校验，再由 Supervisor 汇总为 OperationPlanResult，最后由 Java 系统保存到 operation_plans 和 agent_runs。这样 Java 可以稳定消费 Agent 结果，也方便测试、追踪和后续页面展示。

## 9. 小结

结构化输出是 Agent 工程化的核心。

自然语言让人理解，结构化输出让系统执行。本项目要做的不是让模型说得像人，而是让 Agent 结果能被 Java 系统稳定消费、保存、追踪和复用。
