# 第 14 节：5 个 Agent 的 Prompt 与 Schema 设计原则

## 1. 学习目标

本节目标是理解每个 Agent 后续如何设计 Prompt 和 Schema。

即使第一期先用规则和模板，也应该按 Agent 思维设计：

```text
Prompt 决定 Agent 怎么思考
Schema 决定 Agent 怎么交付结果
```

## 2. Prompt 和 Schema 的关系

```text
Prompt = 给 Agent 的任务说明
Schema = 给 Agent 的输出合同
```

Prompt 告诉 Agent：

- 你是谁。
- 你的职责是什么。
- 你能看哪些输入。
- 你不能做什么。
- 你应该怎么判断。

Schema 告诉 Agent：

- 必须输出哪些字段。
- 字段类型是什么。
- 哪些字段是枚举。
- 哪些字段必填。

## 3. 好的 Agent Prompt 包含什么

每个 Agent Prompt 至少包含：

```text
角色
目标
输入说明
判断规则
禁止事项
输出格式
```

禁止事项很重要，用来避免 Agent 职责越界。

## 4. Supervisor Agent

Prompt 重点：

- 你是流程总控 Agent。
- 你负责按顺序调用和汇总子 Agent。
- 你负责判断整体是否需要人工确认。
- 你负责生成 final_summary。

禁止事项：

- 不自行修改业务事实。
- 不忽略子 Agent 的风险。
- 不把失败结果当成功。

Schema：

```text
trace_id
product_plan
image_plan
inventory_plan
fulfillment_plan
final_summary
manual_review_required
errors
```

## 5. Product Planning Agent

Prompt 重点：

- 负责商品标题、卖点、详情文案、上架建议。
- 根据商品名称、类目、价格、目标人群、使用场景生成建议。

禁止事项：

- 不判断库存。
- 不判断订单是否出货。
- 不生成图片提示词。
- 不承诺夸大功效。

Schema：

```text
recommended_title
selling_points
detail_description
target_user_summary
listing_suggestion
```

## 6. Image Creative Agent

Prompt 重点：

- 负责主图、场景图、营销图的创意说明和提示词。
- 根据商品信息、卖点、目标人群、使用场景生成图片建议。

禁止事项：

- 不判断库存。
- 不判断订单。
- 不生成虚假功效。
- 不使用侵权品牌或敏感元素。

Schema：

```text
main_image_prompt
scene_image_prompt
marketing_image_prompt
image_style
image_risk_notes
```

## 7. Inventory & Purchase Agent

Prompt 重点：

- 负责判断库存状态和补货建议。
- 根据当前库存、已占用库存、安全库存、最近销量、采购周期做判断。

禁止事项：

- 不修改库存。
- 不创建采购单。
- 不判断订单出货。
- 不写商品文案。

Schema：

```text
inventory_status
should_restock
suggested_restock_quantity
restock_priority
reason
```

## 8. Order Fulfillment Agent

Prompt 重点：

- 负责判断当前订单是否可以出货。
- 根据订单状态、付款状态、地址完整性、可用库存判断风险。

禁止事项：

- 不真实发货。
- 不扣库存。
- 不退款。
- 不修改订单，只输出建议状态。

Schema：

```text
can_ship
fulfillment_status
risk_flags
manual_review_required
next_order_status
```

## 9. 事实和建议要区分

Prompt 中要明确：

```text
Product / Inventory / Order 是业务事实
其他 Agent 输出是建议或中间结果
不能把建议当作事实
```

事实变更必须由 Java 系统控制。

## 10. Prompt 和 Schema 都要克制

Prompt 不应太长，只要最小够用。

Schema 不应过早复杂，第一期只保留必要字段，后续再扩展。

## 11. 接入 LLM 后的流程

后续接入 LLM 时：

```text
构造 Prompt
传入结构化上下文
要求输出 JSON
用 Pydantic 校验
校验失败则重试或降级模板
保存 agent_runs
```

LLM 输出必须过 Schema，不过 Schema 就不能进入系统。

## 12. 面试表达

可以这样讲：

> 我为每个 Agent 都设计了明确的 Prompt 和 Schema。Prompt 负责约束 Agent 的角色、目标、输入、判断规则和禁止事项，Schema 负责约束 Agent 的结构化输出。比如库存 Agent 只能根据库存、销量和采购周期生成补货建议，不能修改库存或判断订单履约；订单履约 Agent 只能输出是否可出货、风险标记和下一步建议状态，不能真实发货或扣库存。

## 13. 小结

Prompt 决定 Agent 怎么思考，Schema 决定 Agent 怎么交付结果。

好的多 Agent 系统不是只写几个提示词，而是为每个 Agent 明确角色、边界、输入、禁止事项和结构化输出。
