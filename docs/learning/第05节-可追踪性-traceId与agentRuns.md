# 第 05 节：可追踪性：trace_id 与 agent_runs

## 1. 学习目标

本节目标是理解为什么企业级 Agent 系统必须可追踪。

在本项目中，核心追踪机制是：

```text
trace_id
agent_runs
operation_plans
```

## 2. 企业 Agent 不能只看最终答案

普通 AI Demo 经常是：

```text
输入一句话
模型返回一段话
结束
```

本项目的流程更长：

```text
Java 传入商品、库存、订单
Supervisor 调用 4 个子 Agent
每个 Agent 输出结构化结果
Supervisor 汇总
Java 落库
用户查询结果
```

任何一步都可能出错，因此必须知道答案是怎么来的。

## 3. trace_id 是一次任务的身份证

`trace_id` 是一次 Agent 执行链路的唯一编号。

一次运营分析中的所有记录都挂在同一个 `trace_id` 下：

- Supervisor Agent 执行记录。
- Product Planning Agent 执行记录。
- Image Creative Agent 执行记录。
- Inventory & Purchase Agent 执行记录。
- Order Fulfillment Agent 执行记录。
- 最终 OperationPlanResult。

有了 `trace_id`，可以回答：

```text
这次运营建议是怎么一步步生成的？
```

## 4. agent_runs 记录每个 Agent 做了什么

`agent_runs` 表记录：

```text
trace_id
operation_plan_id
agent_name
input_json
output_json
status
duration_ms
error_message
started_at
finished_at
```

它可以帮助定位：

- Agent 当时拿到了什么输入。
- Agent 输出了什么。
- 是否报错。
- 耗时多久。
- 哪一步导致人工确认。

## 5. 可追踪性解决信任问题

企业使用 AI 的关键不是“AI 能不能回答”，而是：

```text
我为什么相信这个答案？
```

可追踪性让用户和开发者看到：

- 基于什么输入判断。
- 调用了哪些 Agent。
- 每个 Agent 输出了什么。
- 哪一步失败了。
- 为什么需要人工确认。

## 6. 可追踪性和日志不同

日志偏服务运行排查，例如请求、耗时、异常堆栈。

`agent_runs` 是业务级执行记录，回答：

```text
这个 Agent 输入是什么？
输出是什么？
状态是什么？
为什么失败？
```

两者都重要，但第一期先保证 Agent 业务执行记录。

## 7. 为什么第一期不单独设计 tool_runs

理论上，每次工具调用也可以记录到 `tool_runs`。

但第一期目标是框架小闭环，先做到 Agent 级追踪：

```text
一次分析 = 一个 trace_id
一个 Agent 执行 = 一条 agent_runs
最终汇总 = 一条 operation_plans
```

后续再增强为 Tool 调用级追踪。

## 8. 第一阶段完成标准

一次完整执行应产生：

```text
1 条 operation_plans
5 条 agent_runs
```

分别对应：

```text
SUPERVISOR_AGENT
PRODUCT_PLANNING_AGENT
IMAGE_CREATIVE_AGENT
INVENTORY_PURCHASE_AGENT
ORDER_FULFILLMENT_AGENT
```

## 9. 面试表达

可以这样讲：

> 每次多 Agent 执行都会生成 trace_id，Supervisor 和每个子 Agent 都会写入 agent_runs，记录输入、输出、状态、耗时和错误。用户不仅能看到最终运营建议，也能追踪每个 Agent 的判断过程。后续如果补货建议异常或履约判断错误，可以根据 trace_id 定位到具体 Agent 和具体输入输出。

## 10. 小结

Agent 系统不能只给最终答案，必须能追踪答案是怎么来的。

`trace_id` 串起一次完整执行，`agent_runs` 记录每个 Agent 的输入、输出、状态、耗时和错误。这让系统可调试、可复盘、可审计。
