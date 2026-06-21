# 第 12 节：Agent 记忆管理与分类知识库

## 1. 学习目标

本节目标是理解多 Agent 系统中“记忆”和“知识库”的区别，以及为什么后续可以使用共享知识库，但必须做分类输送和访问隔离。

核心原则：

```text
共享知识库底座
+ 分类知识域
+ Agent 权限隔离
+ Supervisor 选择性分发
```

## 2. 记忆和知识库不是一回事

知识库更像外部资料：

```text
平台规则
商品标题案例
图片风格案例
补货策略
订单履约规则
售后规范
```

记忆更像系统历史：

```text
某次 Agent 分析结果
某个商品历史运营建议
某次补货建议是否被采纳
某个订单为什么进入人工确认
```

所以：

```text
知识库 = 外部/沉淀知识
记忆 = 系统执行历史
```

第一期只做轻量执行记忆：

```text
operation_plans
agent_runs
```

## 3. 为什么不能所有 Agent 共用一个大知识库

如果所有 Agent 都随便查一个大知识库，会造成：

- Agent 职责越界。
- 上下文污染。
- 输出不稳定。
- 难以追踪知识来源。
- 权限边界不清。
- 敏感数据泄漏风险。

例如 Image Creative Agent 不应该检索库存补货策略，Order Fulfillment Agent 不应该检索商品营销文案。

## 4. 本项目后续适合的知识域

商品运营知识域：

```text
爆款标题案例
商品卖点模板
平台 SEO 规则
类目运营指南
违禁词规则
```

图片创意知识域：

```text
主图设计规范
场景图案例
营销图模板
图片合规规则
平台图片尺寸要求
```

库存采购知识域：

```text
安全库存策略
补货规则
采购周期经验
库存预警规则
销量波动处理方法
```

订单履约知识域：

```text
发货判断规则
异常订单处理规范
地址问题处理规则
付款状态处理规则
库存不足处理流程
```

Supervisor 策略知识域：

```text
Agent 编排规则
人工确认策略
错误处理策略
任务路由规则
```

## 5. Supervisor 在知识分发中的作用

Supervisor 后续可以作为知识分发者：

- 判断当前任务类型。
- 选择需要哪些知识域。
- 把检索结果分发给对应 Agent。
- 控制每个 Agent 的上下文范围。

这叫选择性知识输送，不是所有 Agent 随便查全部知识库。

## 6. 共享底座，不等于共享全部内容

后续可以共用一个向量数据库或知识库服务，但要分 namespace / collection：

```text
product_operation
image_creative
inventory_purchase
order_fulfillment
supervisor_policy
```

准确说：

```text
共享的是知识库基础设施
隔离的是知识内容和访问权限
```

## 7. 业务事实不要随便放进知识库

商品、库存、订单这类实时业务事实，第一来源应该是 Java 数据库：

```text
products
inventories
orders
```

知识库适合放：

```text
规则
案例
经验
说明文档
历史总结
```

三类数据要分清：

```text
业务事实 -> Java Tool API
运营知识 -> 分类知识库
执行历史 -> operation_plans / agent_runs
```

## 8. 后续演进路线

第一期：无知识库。

```text
Java 数据库 = 业务事实
operation_plans / agent_runs = 执行记忆
Agent 使用规则 / 模板
```

第二期：分类知识库。

```text
product_operation
image_creative
inventory_purchase
order_fulfillment
```

第三期：记忆增强。

```text
从 operation_plans 和 agent_runs 中抽取高质量经验
沉淀为 Agent 私有记忆或知识库案例
```

第四期：知识治理。

```text
知识版本
知识来源
知识权限
知识过期
知识评估
```

## 9. 面试表达

可以这样讲：

> 我没有把所有资料放进一个大知识库让所有 Agent 随便查，而是把知识和记忆分层设计。商品、库存、订单这类实时业务事实由 Java 数据库和 Tool API 提供；平台规则、商品标题案例、图片创意规范、补货策略和履约规则会按领域进入分类知识库；operation_plans 和 agent_runs 保存 Agent 执行记忆。后续每个 Agent 只能检索与自己职责相关的知识域，由 Supervisor 根据任务选择性分发上下文，从而避免知识污染、职责越界和敏感数据泄漏。

## 10. 小结

后续可以用共享知识库，但必须是受控共享。

共享的是知识库基础设施，隔离的是知识域、访问权限和上下文分发。
