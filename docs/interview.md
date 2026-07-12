# 面试讲解文档 · 电商超级个体多 Agent 运营助手

> 面向求职讲解的「话术 + 设计取舍」底稿。配合 `README.md` 的运行与接口说明使用。

## 1. 一句话定位

一个面向「电商超级个体（一个人跑全店）」的 **多 Agent 运营助手**：给定商品/库存/订单，自动产出一套结构化运营计划（选品文案、图片创意、库存补货、履约建议），并支持人工确认/驳回闭环。技术亮点是 **Java 业务系统 + Python 多 Agent 编排的双向 HTTP 闭环**，以及 **本地优先、可降级、不依赖外部付费 API** 的工程实现。

## 2. 架构总览

```
Java Spring Boot (业务 + PostgreSQL 落库)
   │  POST /api/orchestration/generate  （加载业务数据，调 Python）
   ▼
Python FastAPI (Supervisor 编排 4 个 Agent)
   │  POST /api/operation-plans + /api/agent-runs  （写回结果）
   ▼
Java 落库 ──► 前端 SPA 查看计划 / trace / 确认 / 驳回
```

- **Java 边界**：商品/库存/订单/计划/执行记录的业务持久化、REST API、编排入口。
- **Python 边界**：多 Agent 编排与结构化产出；**不持库**，可独立运行（无 DB 也能起服务）。
- **闭环方向**：Java → Python（触发生成）、Python → Java（写回结果）。写回失败时 **降级不阻断**主链路。

## 3. 为什么拆 Java / Python 两个服务

- 业务系统（Java/Spring Boot）与 AI 编排（Python/PyTorch 生态、LangChain）技术栈与迭代节奏不同，分开更易演进。
- 清晰边界：Java 负责「数据与交易一致性」，Python 负责「不确定性的生成与编排」，通过稳定 JSON 契约通信。
- 结构化输出直接复用 Pydantic Schema，Java 侧用通用 `Map<String,Object>`（JSONB）接收，**Schema 扩展向后兼容、前端自动可见**。

## 4. 多 Agent 编排与动态路由

- Supervisor 固定编排 4 个 Agent：商品规划 / 图片创意 / 库存采购 / 订单履约。
- **动态路由（步骤 6）**：用 `_ROUTING` 路由表按 `trigger_type` 决定跑哪些 Agent。例如 `INVENTORY_REVIEW` 只跑库存+履约，跳过选品/图片；默认全量。新增分支只需加一条路由，不改 Agent 内部。
- **失败重试（步骤 6）**：每个 Agent 的 LLM 调用失败重试 1 次，仍失败则降级到规则实现（`_safe_run`），主链路不中断；失败的 Agent 在 `agent_runs` 标 `FAILED` 并写入 `errors`。

## 5. 结构化输出 + 规则降级（核心稳定性设计）

- 每个 Agent 既有 **LLM 路径**（结构化输出），也有 **确定性规则兜底**。
- 关键原则：**确定性内核是权威源**。例如库存预测（`compute_forecast`）和物流风险（`compute_logistics_risk`）是纯确定性推算，LLM 路径只贡献「可读的原因文案」，数字与决策一律来自确定性内核——避免 LLM 臆造导致落库与 trace 不一致。
- 降级链：LLM 关 → 规则实现；LLM 调用异常 → 重试 → 规则实现；RAG 关/嵌入不可用 → 空知识串；图片审核失败 → 不丢创意方案。

## 6. 本地优先的「真能力」（不引外部付费 API）

- **真实 LLM**：本地 Ollama（OpenAI 兼容 `/v1`），结构化输出复用现有 Schema；关闭后全规则，离线可跑。
- **分类知识库 RAG**：本地 Markdown 知识库 + 内存 Chroma 向量检索，注入商品/图片 Agent，使其引用平台规则/违禁词/SEO。
- **图片视觉审核**：本地 LLM 对创意方案做合规/质量审核，产出 `image_review_result`。
- **物流异常 + 售后联动**：基于订单/库存上下文的确定性风险检测与处理建议，售后仅用计划内字段表达（不新增表）。

> 讲解要点：这些能力都可在「无外部 API Key、无费用」前提下本地演示，符合作品集「可复现」诉求。

## 7. 人工确认闭环（端到端可读可演示）

- `operation_plans` 表加 `confirmation_status` / `confirmed_at` 两列（**不新增表**）。
- Java 提供 `POST /api/operation-plans/{id}/confirm|reject`，前端详情页展示确认状态并可「确认/驳回」，落库后按钮禁用。
- 这条链路把「AI 产出」与「人做最终决策」连接起来，是作品集里最能体现业务闭环的一段。

## 8. 一键演示路径（作品集现场）

1. `docker compose up -d --build` → 打开 `http://localhost`（nginx 反代）。
2. 已内置示例数据：商品/库存/订单 + 一条运营计划（含 5 条 Agent trace）和「确认/驳回」可直接演示。
3. 点开计划看四类产出与 trace；点「确认/驳回」看状态变化。
4. 可选：本地起 Ollama 并把 `LLM_ENABLED=true`，触发一次真实编排看 LLM 文案差异。

## 9. 设计取舍与可扩展点（被问到时的加分项）

- **为什么不用 LangGraph？** 当前路由是「条件步骤 + 重试」，轻量 Python 实现已足够，避免重依赖；若未来要「Agent 间反思/回溯」，可平滑替换为 LangGraph 图，接口不变。
- **为什么不引真实物流/支付 API？** 作品集以「架构与闭环」为主，外部 API 属接入层，且本机环境受限；接口预留 `trigger_type` 与确定性内核，接入真实服务只需替换内核实现。
- **为什么确认存计划表而非独立表？** 保持小闭环、改动最小；若确认需要审计流水，可平滑拆出 `confirmations` 表。
- **可观测性**：每个 Agent 的 `input_json/output_json/error_message/duration_ms` 全量落库，天然形成执行 trace，便于调试与演示。
- **扩展方向**：接入真实 LLM/物流、RAG 换持久化向量库、Supervisor 升级为带反思的图编排、加链路监控与回放。

## 10. 一句话收尾

「这个项目用一个可降级、本地优先的多 Agent 编排，把电商日常运营的几个环节串成闭环，并用 Java/Python 双向 HTTP + 结构化落库保证工程上可观测、可演示、不依赖外部付费服务。」
