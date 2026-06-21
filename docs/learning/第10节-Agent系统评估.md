# 第 10 节：Agent 系统评估

## 1. 学习目标

本节目标是理解 Agent 系统不能只看“回答好不好”，而要从结构、业务规则、流程、职责和可追踪性多个层面评估。

## 2. Agent 评估要分层

本项目至少从 5 层评估：

```text
结构是否正确
业务判断是否合理
流程是否完整
系统是否稳定
结果是否可追踪
```

最终摘要写得好，不代表系统合格。

## 3. 结构化输出评估

每个 Agent 必须返回固定结构。

例如 Inventory & Purchase Agent 必须包含：

```text
inventory_status
should_restock
suggested_restock_quantity
restock_priority
reason
```

评估内容：

- 字段是否存在。
- 字段类型是否正确。
- 枚举值是否合法。
- JSON 是否能被 Java 保存。

## 4. 业务规则评估

一些判断必须稳定：

```text
未付款 -> 不能出货
地址不完整 -> 需要人工确认
可用库存 < 订单数量 -> 库存不足
```

如果订单未付款却输出 `can_ship = true`，就是严重错误。

## 5. Agent 职责边界评估

每个 Agent 不应越界：

- Product Planning Agent 不判断订单出货。
- Image Creative Agent 不修改库存。
- Inventory Agent 不生成商品标题。
- Order Fulfillment Agent 不写图片提示词。

职责边界清晰是多 Agent 项目的工程质量。

## 6. 流程完整性评估

一次完整执行应产生：

```text
1 个 trace_id
1 条 operation_plans
5 条 agent_runs
```

并且 5 个 Agent 都参与执行。

## 7. 可追踪性评估

系统输出 `manual_review_required = true` 时，要能查到：

- 哪个 Agent 提出的。
- 风险原因是什么。
- 输入数据是什么。
- 输出结果是什么。

否则系统不可信。

## 8. 第一阶段评估样例

样例 1：正常商品 + 库存充足 + 已付款订单。

预期：

```text
should_restock = false
can_ship = true
manual_review_required = false
```

样例 2：库存低于安全库存。

预期：

```text
should_restock = true
inventory_status = RISK
restock_priority = HIGH
```

样例 3：订单未付款。

预期：

```text
can_ship = false
manual_review_required = true
risk_flags 包含“订单未付款”
```

样例 4：地址不完整。

预期：

```text
can_ship = false
manual_review_required = true
risk_flags 包含“收货地址不完整”
```

样例 5：销售价低于成本价。

预期：

```text
标记需要人工确认
final_summary 提醒价格异常
```

## 9. 接入 LLM 后的评估

确定性字段继续规则评估：

```text
should_restock
can_ship
manual_review_required
next_order_status
```

生成性字段做质量评估：

```text
recommended_title 是否包含商品核心词
selling_points 是否覆盖目标人群
image_prompt 是否符合商品场景
reason 是否解释清楚判断依据
```

## 10. 面试表达

可以这样讲：

> 我没有只用主观感觉评估 Agent 输出，而是把评估拆成结构、业务规则、职责边界、流程完整性和可追踪性几层。第一期先用固定样例测试库存补货、订单履约和人工确认等确定性逻辑，确保每个 Agent 输出符合 Pydantic Schema，并且一次执行能生成 trace_id、operation_plans 和 5 条 agent_runs。

## 11. 小结

Agent 系统评估不能只看回答顺不顺。

第一期先用固定样例和自动化测试评估 5 个 Agent 的结构化输出和业务规则，后续再评估 LLM 生成质量。
