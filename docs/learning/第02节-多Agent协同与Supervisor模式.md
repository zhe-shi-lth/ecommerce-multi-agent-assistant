# 第 02 节：多 Agent 协同与 Supervisor 模式

## 1. 学习目标

本节目标是理解多 Agent 系统为什么要拆分、怎么协作，以及为什么本项目第一阶段采用 `Supervisor Agent` 集中式编排。

学完本节后，要能回答：

- 为什么不只做一个万能 Agent？
- 为什么第一期拆成 5 个 Agent？
- Supervisor Agent 负责什么？
- 固定流程编排和动态路由有什么区别？
- 多 Agent 协同中最容易出问题的地方是什么？

## 2. 为什么不能只做一个万能 Agent

最简单的做法是只写一个 Agent：

```text
商品 + 库存 + 订单
  -> 一个万能 Agent
  -> 输出所有建议
```

这个方式初期看起来简单，但问题很明显：

- 职责太多，提示词会越来越长。
- 输出容易混乱，一会儿讲商品文案，一会儿讲库存，一会儿讲出货。
- 很难单独测试某一块能力。
- 很难判断错误来自哪里。
- 后续增强时容易变成一个不可维护的大块逻辑。

企业项目里最怕这种“看起来智能，实际上不可控”的系统。

所以我们要拆分 Agent，让每个 Agent 只负责一个明确领域。

## 3. 多 Agent 的核心思想

多 Agent 的核心不是“Agent 数量越多越高级”，而是：

> 把复杂任务拆成多个职责清晰、输入输出明确、可独立测试的智能单元。

拆分 Agent 的常见方式：

- 按业务职责拆分。
- 按流程阶段拆分。
- 按工具能力拆分。
- 按审核和执行边界拆分。

本项目第一期采用的是“按业务职责拆分”：

```text
Product Planning Agent        -> 商品运营规划
Image Creative Agent          -> 图片创意建议
Inventory & Purchase Agent    -> 库存补货判断
Order Fulfillment Agent       -> 订单出货判断
Supervisor Agent              -> 流程总控与结果汇总
```

这样拆分后，每个 Agent 的目标都清楚，输入输出也容易设计。

## 4. 本项目为什么拆成 5 个 Agent

本项目第一期目标是“大框架、小闭环”。所以 5 个 Agent 全部存在，但每个 Agent 能力先轻量实现。

### 4.1 Supervisor Agent

职责：

- 接收 Java 传入的商品、库存和订单上下文。
- 创建 `trace_id`。
- 按固定顺序调用 4 个子 Agent。
- 汇总每个 Agent 的结构化结果。
- 生成最终运营建议。
- 判断是否需要人工确认。

它不是专门处理商品、图片、库存或出货的 Agent，而是流程总控。

### 4.2 Product Planning Agent

职责：

- 根据商品信息生成标题。
- 生成商品卖点。
- 生成详情页文案草稿。
- 给出上架建议。

它负责“商品怎么卖”。

### 4.3 Image Creative Agent

职责：

- 生成主图提示词。
- 生成场景图提示词。
- 生成营销图提示词。
- 给出图片风格和风险提示。

它负责“商品怎么展示”。

### 4.4 Inventory & Purchase Agent

职责：

- 判断库存是否充足。
- 判断是否需要补货。
- 给出建议补货数量。
- 给出补货优先级和原因。

它负责“货够不够、要不要进货”。

### 4.5 Order Fulfillment Agent

职责：

- 判断订单是否可以出货。
- 检查是否已付款。
- 检查地址是否完整。
- 检查库存是否支持出货。
- 判断是否需要人工确认。

它负责“订单能不能发”。

## 5. Supervisor 模式是什么

Supervisor 模式可以理解成：

> 有一个总控 Agent 负责组织其他 Agent 工作，其他 Agent 不随意互相调用。

本项目第一期流程：

```text
Java Product + Inventory + Order
  -> Supervisor Agent
  -> Product Planning Agent
  -> Image Creative Agent
  -> Inventory & Purchase Agent
  -> Order Fulfillment Agent
  -> Supervisor Agent 汇总
  -> Java 保存结果
```

Supervisor 的价值：

- 统一管理流程。
- 统一传递上下文。
- 统一收集输出。
- 统一处理错误。
- 统一生成最终结果。
- 统一维护 trace 链路。

这样系统更容易调试，也更符合第一期学习目标。

## 6. 为什么第一期不用 Agent 之间自由对话

有些多 Agent 框架会让 Agent 之间自由讨论，比如：

```text
商品 Agent 问库存 Agent
库存 Agent 问订单 Agent
订单 Agent 再问商品 Agent
```

这种方式看起来很智能，但第一期不适合我们。

原因：

- 对话链路难追踪。
- 执行顺序不稳定。
- 输出结果不稳定。
- 很难定位哪个 Agent 出错。
- 对初学者不利于理解工程边界。

所以第一期我们选择更稳的方式：

```text
子 Agent 不直接互相对话
所有调用由 Supervisor 统一组织
所有结果由 Supervisor 统一汇总
```

这不是能力弱，而是工程上更可控。

## 7. 固定流程编排和动态路由

### 7.1 固定流程编排

固定流程编排就是每次都按同一个顺序执行：

```text
Product Planning
-> Image Creative
-> Inventory & Purchase
-> Order Fulfillment
```

优点：

- 简单。
- 稳定。
- 易测试。
- 易追踪。
- 适合第一期框架搭建。

缺点：

- 不够灵活。
- 即使某些场景不需要图片建议，也会执行 Image Creative Agent。
- 后续复杂业务会显得僵硬。

### 7.2 动态路由

动态路由是由 Supervisor 根据任务内容决定调用哪些 Agent。

例如：

```text
如果只做库存检查 -> 只调用 Inventory & Purchase Agent
如果只做商品上架 -> 调用 Product Planning + Image Creative
如果订单地址缺失 -> Order Fulfillment 直接要求人工补充
```

优点：

- 更灵活。
- 更接近真实业务。
- 可以减少不必要执行。

缺点：

- 设计复杂。
- 测试复杂。
- 错误处理复杂。
- 不适合第一期一上来就做。

所以本项目策略是：

```text
第一期：固定流程编排
后续增强：动态路由
```

## 8. 多 Agent 协同中的上下文传递

多 Agent 系统里，上下文不能乱传。

第一期建议上下文分三类：

### 8.1 原始业务上下文

来自 Java：

```text
Product
Inventory
Order
trigger_type
```

这些是业务事实。

### 8.2 Agent 中间结果

例如：

```text
Product Planning Agent 输出 selling_points
Image Creative Agent 使用 selling_points 生成图片提示词
Inventory & Purchase Agent 输出库存风险
Order Fulfillment Agent 根据库存和订单判断是否可出货
```

这些是 Agent 推理结果。

### 8.3 最终汇总结果

由 Supervisor 统一生成：

```text
OperationPlanResult
```

包含：

- product_plan。
- image_plan。
- inventory_plan。
- fulfillment_plan。
- final_summary。
- manual_review_required。
- errors。

## 9. 多 Agent 协同最容易出的问题

### 9.1 职责边界不清

比如 Product Planning Agent 也开始判断库存，Inventory Agent 也开始写商品标题。

解决方式：

- 每个 Agent 只做自己的事。
- 通过 Schema 限定输出字段。
- 在测试中检查输出结构。

### 9.2 输出格式不稳定

如果 Agent 一会儿返回自然语言，一会儿返回 JSON，Java 就无法稳定落库。

解决方式：

- 使用 Pydantic Schema。
- 每个 Agent 都输出固定结构。
- 输出校验失败时记录错误。

### 9.3 调用链路不可追踪

如果不知道每个 Agent 输入了什么、输出了什么，就无法调试。

解决方式：

- 每次执行创建 `trace_id`。
- 每个 Agent 写入 `agent_runs`。
- 记录输入、输出、状态、耗时和错误。

### 9.4 Agent 越拆越多

Agent 太多会导致系统复杂度上升。

解决方式：

- 第一阶段固定 5 个 Agent。
- 不为了“看起来高级”继续加 Agent。
- 后续只有当职责真的复杂到需要拆分时再新增。

## 10. 本项目第一期的协同策略

第一期协同策略可以总结为：

```text
集中式 Supervisor
+ 固定执行顺序
+ 结构化输入输出
+ trace_id 全链路追踪
+ Java 负责业务落库
+ Python 负责 Agent 协同
```

这套策略不追求一开始最智能，但追求：

- 能跑通。
- 能解释。
- 能调试。
- 能落库。
- 能演示。
- 能逐步增强。

## 11. 面试表达方式

可以这样讲：

> 我没有把所有智能逻辑都塞进一个大 Agent，而是按电商运营职责拆成 5 个 Agent。第一期采用 Supervisor 集中式编排，由 Supervisor 接收 Java 传入的商品、库存、订单上下文，再按固定顺序调用商品规划、图片创意、库存补货、订单履约 4 个子 Agent。每个 Agent 都有明确输入输出，最终由 Supervisor 汇总成 OperationPlanResult，并通过 Java 系统保存到 operation_plans 和 agent_runs 表中。这样可以保证多 Agent 协作过程可追踪、可测试、可落库，后续再逐步增强动态路由和复杂工具调用。

## 12. 小结

多 Agent 的价值不在于数量，而在于职责拆分和协同边界。

本项目第一期选择 5 个 Agent，是为了同时体现：

- 商品运营。
- 图片创意。
- 库存补货。
- 订单履约。
- 流程总控。

第一期采用 Supervisor 模式，是为了先保证系统稳定、可控、可追踪。后续当框架跑通后，再增强动态路由、失败重试、人工确认策略和更复杂的工具调用。

## 13. 项目级执行推演

下面用一次真实业务流程来理解 Supervisor 如何组织 5 个 Agent。

假设商家录入了一个商品：

```text
商品名称：便携式榨汁杯
商品类目：小家电
成本价：39 元
销售价：89 元
目标人群：上班族、健身人群、学生
使用场景：办公室、健身房、宿舍、旅行
当前库存：18
已占用库存：5
安全库存：20
最近 7 天销量：32
采购周期：5 天
订单数量：2
订单状态：待分析
是否付款：已付款
地址是否完整：完整
```

Java 系统把这些信息封装成：

```text
Product + Inventory + Order + trigger_type
```

然后调用 Python：

```text
POST /agent/ecommerce/operation-plan
```

### 13.1 Supervisor 接收任务

Supervisor Agent 第一步不是直接生成结论，而是建立本次执行上下文。

它要做：

- 生成 `trace_id`。
- 保存原始输入上下文。
- 准备调用 4 个子 Agent。
- 初始化错误列表。
- 初始化最终结果对象。

可以理解为：

```text
Supervisor 不负责所有专业判断
Supervisor 负责让专业 Agent 按顺序完成判断
```

### 13.2 调用 Product Planning Agent

Supervisor 把商品信息交给 Product Planning Agent。

Product Planning Agent 关注的是：

- 这个商品应该怎么表达？
- 标题怎么写？
- 卖点怎么提炼？
- 详情页文案怎么组织？
- 是否适合直接上架？

它可能输出：

```json
{
  "recommended_title": "便携式无线榨汁杯 家用小型果汁机",
  "selling_points": [
    "便携随行，适合办公室和健身房使用",
    "一键榨汁，适合日常果蔬饮品",
    "体积小巧，适合宿舍和旅行携带"
  ],
  "detail_description": "这款便携式榨汁杯适合上班族、健身人群和学生使用，可用于制作果汁、奶昔和轻食饮品。",
  "target_user_summary": "适合追求健康饮食和便携生活方式的人群。",
  "listing_suggestion": "建议突出便携、易清洗和多场景使用。"
}
```

这个结果会进入 Supervisor 的上下文，后面的 Image Creative Agent 可以使用其中的卖点。

### 13.3 调用 Image Creative Agent

Image Creative Agent 不需要重新判断库存，也不需要判断订单能不能发货。

它只关心：

- 主图怎么表现商品？
- 场景图怎么体现使用场景？
- 营销图怎么突出卖点？
- 有没有图片风险？

它可能输出：

```json
{
  "main_image_prompt": "白色背景，便携式榨汁杯居中展示，突出杯身、小巧、无线便携。",
  "scene_image_prompt": "办公室桌面场景，一位上班族使用便携榨汁杯制作果汁，画面干净明亮。",
  "marketing_image_prompt": "突出一键榨汁、便携随行、易清洗三个卖点，适合电商详情页首屏。",
  "image_style": "清新、明亮、生活方式风格。",
  "image_risk_notes": [
    "避免出现夸大功效描述",
    "避免使用医疗健康暗示"
  ]
}
```

这里可以看到，多 Agent 协作不是简单重复调用模型，而是每个 Agent 利用上下文完成自己的专业任务。

### 13.4 调用 Inventory & Purchase Agent

Inventory & Purchase Agent 只关心库存和补货。

它看到：

```text
当前库存 18
已占用库存 5
可用库存 13
安全库存 20
最近 7 天销量 32
采购周期 5 天
```

它可能判断：

```json
{
  "inventory_status": "RISK",
  "should_restock": true,
  "suggested_restock_quantity": 50,
  "restock_priority": "HIGH",
  "reason": "可用库存低于安全库存，最近 7 天销量较高，且采购周期为 5 天，存在断货风险。"
}
```

这个 Agent 的价值在于，它把库存数据转成了业务判断。

不是简单说“库存 18”，而是说：

```text
库存有断货风险，需要尽快补货。
```

### 13.5 调用 Order Fulfillment Agent

Order Fulfillment Agent 只关心订单履约。

它看到：

```text
订单数量 2
可用库存 13
已付款
地址完整
```

它可能输出：

```json
{
  "can_ship": true,
  "fulfillment_status": "READY_TO_SHIP",
  "risk_flags": [],
  "manual_review_required": false,
  "next_order_status": "READY_TO_SHIP"
}
```

如果换一个场景：

```text
未付款
地址不完整
库存不足
```

它就应该输出：

```json
{
  "can_ship": false,
  "fulfillment_status": "NEEDS_REVIEW",
  "risk_flags": [
    "订单未付款",
    "收货地址不完整",
    "库存不足"
  ],
  "manual_review_required": true,
  "next_order_status": "NEEDS_REVIEW"
}
```

这说明 Agent 的判断要服务业务流程，而不是只生成解释文本。

### 13.6 Supervisor 汇总结果

当 4 个子 Agent 都执行完后，Supervisor 会把结果汇总成 `OperationPlanResult`。

最终结果大概是：

```json
{
  "trace_id": "trace_20260621_001",
  "product_plan": {},
  "image_plan": {},
  "inventory_plan": {},
  "fulfillment_plan": {},
  "final_summary": "商品适合上架，建议突出便携和多场景使用；图片创意以清新生活方式为主；库存存在断货风险，建议高优先级补货；当前订单满足出货条件。",
  "manual_review_required": false,
  "errors": []
}
```

然后 Python 返回给 Java。

Java 负责：

- 保存 `operation_plans`。
- 保存每个 Agent 的 `agent_runs`。
- 更新订单建议状态。
- 提供查询接口给用户查看结果。

## 14. 为什么这叫协同，而不是顺序调用函数

表面看，它像是顺序调用 4 个函数。

但多 Agent 协同和普通函数调用的区别在于：

| 对比点 | 普通函数 | Agent |
| --- | --- | --- |
| 输入 | 固定参数 | 业务上下文 + 推理目标 |
| 输出 | 固定计算结果 | 结构化判断 + 解释原因 |
| 能力来源 | 代码逻辑 | 规则、提示词、LLM、工具调用 |
| 可扩展性 | 改代码 | 可增强 Prompt、工具、模型和上下文 |
| 适用场景 | 确定性计算 | 半结构化业务判断 |

第一期我们可以先用规则或模板实现 Agent，看起来像函数；但它的设计边界已经按 Agent 来建。

后续一旦接入 LLM、工具调用、动态路由和失败重试，这个框架就能自然升级。

所以第一期的重点不是“现在有多智能”，而是：

```text
先把多 Agent 协作的骨架搭正确
再逐步增强每个 Agent 的智能能力
```

## 15. Supervisor 的核心不是聪明，而是可靠

很多人一开始做 Agent，会追求 Supervisor 很聪明：

- 自动规划。
- 自动选工具。
- 自动选择 Agent。
- 自动重试。
- 自动反思。

这些能力当然重要，但第一期不急。

第一期 Supervisor 最重要的是可靠：

- 每次执行顺序稳定。
- 每个 Agent 输入明确。
- 每个 Agent 输出可校验。
- 每一步都能记录。
- 出错能知道错在哪里。
- Java 能稳定保存结果。

这就是工程化思维。

智能系统不是越自由越好，尤其在企业项目里，第一要求是可控。

## 16. 本节复盘问题

学完这一节，可以用下面问题自测：

1. 为什么本项目不做一个万能 Agent？
2. 为什么第一期采用 Supervisor 集中式编排？
3. Product Planning Agent 和 Image Creative Agent 的职责边界是什么？
4. Inventory & Purchase Agent 和 Order Fulfillment Agent 的职责边界是什么？
5. 固定流程编排有什么优缺点？
6. 为什么第一期不做动态路由？
7. `trace_id` 在多 Agent 协同中有什么价值？
8. 为什么 Agent 输出必须结构化？

如果这些问题能回答清楚，就说明已经理解了本项目第一期多 Agent 协同的核心设计。
