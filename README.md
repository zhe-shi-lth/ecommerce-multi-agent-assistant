# 电商超级个体 · 多 Agent 运营助手

一个面向「电商超级个体」的多 Agent 运营助手，目标为 **大框架、小闭环**。第二期已在稳定主链路之上逐个增强 Agent 真实能力（本地 LLM 编排、分类知识库 RAG、本地图片视觉审核、库存需求预测、物流异常 + 售后联动、Supervisor 动态路由与失败重试、前端人工确认/驳回闭环）。

- **Python 多 Agent 服务**：Supervisor 编排 4 个运营 Agent（选品规划 / 图像创意 / 库存采购 / 订单履约），结构化输出运营计划。
- **Java Spring Boot 业务服务**：PostgreSQL 落库，提供商品 / 库存 / 订单 / 运营计划 / Agent 执行记录等 REST API。
- **Java ↔ Python 双向 HTTP 闭环**：Java 编排入口加载业务数据并调用 Python 生成计划；Python 生成后通过 Tool API 把计划与执行明细写回 Java。

> **本地优先**：不接真实电商 / 支付 / 物流 / 图片生成 API。真实 LLM 走本地 Ollama（可选，关闭或选「规则」模式时走确定性规则实现，主链路不中断）。前端通过 Docker Compose 内 nginx 反代访问 Java，无需改 Java CORS。

---

## 架构与边界

```
┌────────────────────────┐         POST /api/orchestration/generate         ┌────────────────────────┐
│   Java Spring Boot     │ ───────────────────────────────────────────────▶ │   Python FastAPI       │
│   (业务 + 落库)         │                                                    │   (多 Agent 编排)        │
│                        │ ◀──── POST /api/operation-plans + /api/agent-runs ┤                        │
│  products / inventories│         (Python 调 Java 写回结果)                  │  Supervisor + 4 Agents │
│  / orders / operation_ │                                                    │                        │
│  plans / agent_runs    │ ───────────── PostgreSQL (Flyway 建表) ──────────▶│                        │
└────────────────────────┘                                                    └────────────────────────┘
```

| 职责 | Java 侧 | Python 侧 |
| --- | --- | --- |
| 业务数据持久化 | ✅ Entity / Repository / Flyway | ❌（不持库，可独立运行） |
| 运营计划生成 | 编排入口（调 Python） | ✅ Supervisor 固定顺序编排 4 Agent |
| 结果落库 | ✅ REST Tool API | ✅ 调用 Java 写回（Java 不可用时降级，不阻断） |
| 对外 REST API | ✅ 业务 + 编排 + 查询 | ✅ `POST /agent/ecommerce/operation-plan` |

---

## 目录结构

```
.
├── docker-compose.yml          # 全栈：PostgreSQL + Java + Python + 前端(nginx 反代)
├── .env / .env.example         # 数据库与数据源配置
├── java-service/               # Spring Boot 业务服务 (JDK 21)
│   └── src/main/java/com/lth/ecommerceagent/
│       ├── product/ inventory/ order/ operation/ agent/   # 各域 Controller/Entity/Repository/DTO
│       ├── orchestration/      # 编排入口 OrchestrationController
│       └── python/             # PythonAgentClient (Java 调 Python)
├── python-agent-service/       # FastAPI 多 Agent 服务 (Python 3.11)
│   └── app/
│       ├── agents/             # supervisor + 4 个 agent
│       ├── schemas/            # Pydantic 结构化输出
│       ├── tools/java_api_client.py   # JavaApiClient (Python 调 Java)
│       └── api/operation_plan.py      # 运营计划端点
└── scripts/demo_e2e.py         # 端到端小闭环验证脚本
```

---

## 已增强能力（第二期）

在稳定主链路之上逐步骤增强 Agent 真实能力，每一步均 **向后兼容、Java 落库契约不变、前端自动可见**：

| 步骤 | 增强 | 关键设计 |
| --- | --- | --- |
| 0 | 接入本地 LLM（Ollama） | 5 个 Agent 结构化输出复用 Pydantic Schema；LLM 调用失败直接报错（不静默降级到规则），由前端弹窗提示；关闭或选「规则」模式时显式走确定性规则实现 |
| 0.5 | 前端只读 SPA | React + Vite，查看计划/四类产出/Agent trace/商品库存订单 |
| 1 | 商品规划增强 | SEO 关键词 + 淘宝/抖音/小红书多平台文案 |
| 2 | 分类知识库 RAG | 本地 Markdown 知识库 + 内存 Chroma 向量检索，注入商品/图片 Agent（可选，关 RAG 不影响主链路） |
| 3 | 图片视觉审核 | 本地 LLM 对创意方案做合规/质量审核，产出 `image_review_result`（可选，关则走规则启发式） |
| 4 | 库存需求预测 | 确定性 `compute_forecast`：日均需求/预计售罄天数/补货量/风险等级；LLM 仅写可读原因，数字由预测决定 |
| 5 | 物流异常 + 售后联动 | 本地确定性物流风险检测（未付款/地址不全/库存不足/大单分批/库存紧张/需复核）+ 处理建议 + 售后建议 |
| 6 | Supervisor 动态路由 + 前端确认 | 按 `trigger_type` 条件路由（演示分支 `INVENTORY_REVIEW` 仅库存+履约）；LLM 调用失败重试 1 次仍失败则直接报错（不降级）；前端可对计划「确认/驳回」并落库 |

---

## 运行前提

> 本机实测踩坑点，务必先看，否则编译 / 连接会失败。

### 1. JDK 21（必备）
项目使用 JDK 21。运行前请确保 `JAVA_HOME` 指向你的 JDK 21 安装目录：

```bash
# 示例（请按你的实际安装路径调整）
export JAVA_HOME="/path/to/jdk-21"
export PATH="$JAVA_HOME/bin:$PATH"
java -version   # 确认 21.x
```

### 2. Maven
已安装 Maven 时直接运行（本文档采用此方式，PowerShell 下直接可用）：

```bash
cd java-service
mvn spring-boot:run
```

未单独安装 Maven 也可用项目自带的 Maven Wrapper：
- Linux / macOS / Git Bash：`./mvnw spring-boot:run`
- Windows PowerShell：`.\mvnw.cmd spring-boot:run`（PowerShell 不会从当前目录直接运行命令，需 `.\` 前缀）

> **Windows + Git Bash 注意**：在 Git Bash 中直接敲 `mvn` 可能调用 Unix 启动脚本并报告
> `ClassNotFoundException: org.codehaus.plexus.classworlds.launcher.Launcher`；此时改用 `./mvnw` 或 `mvn.cmd`。

### 3. Docker / PostgreSQL
需要 Docker 且能拉取 `postgres:16` 镜像（如所在网络需配置镜像源，请自行设置 Docker `registry-mirrors`）：

```bash
docker compose up -d postgres
```

> 连接信息见 `.env`：`ecommerce_agent / ecommerce / ecommerce_password`，端口 `5432`。
> Flyway 在 Java 启动时自动建 6 张表（`products / inventories / orders / operation_plans / agent_runs / flyway_schema_history`）。

### 4. Python
```bash
cd python-agent-service
uv sync
uv run fastapi dev app/main.py   # 端口 8000，无需数据库
```

### 5. LLM 配置（可选，默认本地 Ollama）

5 个 Agent 默认走「规则实现」。要接入真实 LLM，需本地运行 Ollama（OpenAI 兼容协议）：

```bash
# 安装并拉取一个支持工具调用的模型（中文场景推荐 qwen2.5）
ollama pull qwen2.5:latest
ollama list   # 确认模型已就绪
```

Python 服务通过环境变量控制 LLM（可用 `python-agent-service/.env` 提供，已加载）：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `LLM_ENABLED` | `true` | 是否启用真实 LLM；设为 `false` 则全部退回规则实现（无需 Ollama）。 |
| `LLM_BASE_URL` | `http://localhost:11434/v1` | OpenAI 兼容端点，指向 Ollama 的 `/v1`。 |
| `LLM_MODEL` | `qwen2.5:latest` | 模型名，需与 `ollama pull` 的模型一致。 |
| `LLM_API_KEY` | `ollama` | Ollama 无需真实 key，填任意值即可。 |
| `LLM_TEMPERATURE` | `0.3` | 生成温度。 |
| `LLM_TIMEOUT_MS` | `30000` | 单次调用超时（毫秒）。 |

- 结构化输出直接复用 Agent 的 Pydantic Schema，Java 落库契约不变。

### 6. 分类知识库 RAG（可选，横向赋能）

商品规划（Product Planning）与图片创意（Image Creative）两个 Agent 会检索「分类知识库」并把命中内容注入 prompt，使产出引用平台规则、违禁词与 SEO 建议。知识库为本地向量检索（Ollama 嵌入 + 内存 Chroma），**不改 Java/Postgres，Python 仍不持库、可独立运行**。

知识以 Markdown 沉淀，一个类目一个文件：

```
python-agent-service/knowledge/
├── Home.md        # 类目名取文件名
├── Beauty.md
└── Apparel.md
```

每个文件按 `#`/`##` 组织「平台规则 / 违禁词 / SEO 建议」即可，例如：

```markdown
# Home 运营知识库
## 平台规则
### 淘宝
- 标题核心词前置
## 违禁词
- 绝对化用语：最、第一、国家级
## SEO 建议
- 核心词：保温杯、便携水杯
```

启用步骤（需本地 Ollama）：

```bash
ollama pull nomic-embed-text   # 本地 embedding 模型
```

Python 服务通过环境变量控制（默认值即开启，关闭后行为与改造前完全一致）：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `RAG_ENABLED` | `true` | 关闭后不检索知识库，Agent 行为与改造前一致。 |
| `RAG_KNOWLEDGE_DIR` | `knowledge` | 知识库目录（相对 `python-agent-service/`，或绝对路径）。 |
| `RAG_EMBEDDING_MODEL` | `nomic-embed-text` | 本地 embedding 模型名。 |
| `RAG_EMBEDDING_BASE_URL` | `http://localhost:11434/v1` | embeddings 端点，默认复用 LLM 的 Ollama `/v1`。 |
| `RAG_TOP_K` | `3` | 每个类目召回的块数。 |
| `RAG_CHUNK_SIZE` / `RAG_CHUNK_OVERLAP` | `500` / `50` | 切块参数（可选）。 |

- 检索结果会写入 `PRODUCT_PLANNING_AGENT` 的运行轨迹 `input_json.retrieved_knowledge`，前端「运行详情」可直接查看注入了哪些知识。
- 优雅降级：RAG 关闭 / 嵌入模型不可用 / 检索异常时返回空知识串，主链路不中断。

### 7. 图片视觉审核（可选，全本地）

Image Creative Agent 在生成图片创意方案后，会用**本地 LLM** 对方案做一次独立「视觉合规/质量审核」，产出结构化结果：

```json
{
  "overall_score": 92,
  "risk_level": "低风险",
  "issues": [],
  "suggestions": ["可直接使用"],
  "reviewer": "llm"
}
```

- 审核复用本地 Ollama（与生成同一 `LLM_*` 配置），**不接外部图片生成 API、不引 key、无费用**。
- 审核结果随 `ImagePlan.image_review_result` 一并返回，并写入 `IMAGE_CREATIVE_AGENT` 的运行轨迹 `output_json`，前端「运行详情」图片创意块与 trace 自动可见。
- 关闭 `IMAGE_REVIEW_ENABLED=false` 后不再产出审核字段，行为与改造前一致。
- 优雅降级：审核 LLM 调用失败时不丢弃已生成的创意方案，审核结果置为 `null`；LLM 关闭（规则路径）时走确定性启发式审核（`reviewer="rule"`）。

Python 服务通过环境变量控制：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `IMAGE_REVIEW_ENABLED` | `true` | 关闭后不产出图片审核结果。 |

- LLM 调用失败（如 Ollama 未启动、Key 缺失、端点不可达）：Supervisor 先重试 1 次，仍失败则**直接报错**（422 中文可读），由前端弹窗提示，**不再静默降级到规则实现**；失败的 Agent 在 `agent_runs` 中标记为 `FAILED` 并写入 `errors`。
- 切换其他 OpenAI 兼容提供方（如 DeepSeek）：把 `LLM_BASE_URL` / `LLM_MODEL` / `LLM_API_KEY` 改掉即可，代码无需改动。

### 6. 前端（Node）

前端是独立 React + Vite SPA（`frontend/` 目录），需 Node.js 18+（本机实测 v24）。开发期由 Vite 把 `/api` 代理到 Java，无需改 Java CORS。

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

---

## 启动四个服务

1. **PostgreSQL**：`docker compose up -d postgres`
2. **Java**：在 `java-service` 目录运行 `mvn spring-boot:run`（本文档采用；或用 Maven Wrapper）
3. **Python**：`uv run fastapi dev app/main.py`（`python-agent-service` 目录）
4. **前端**：`cd frontend && npm install && npm run dev`（`http://localhost:5173`）

前端通过 Vite 代理访问 Java（`:8080`），因此启动顺序：先起 PostgreSQL/Java/Python，再起前端。

健康检查：
- Java：`GET http://localhost:8080/health`
- Python：`GET http://localhost:8000/health`
- Java Swagger UI：`http://localhost:8080/docs`

---

## 一键启动（Docker Compose 全栈）

无需本机安装 JDK/Maven/Python/Node，一条命令起全栈（PostgreSQL + Java + Python + 前端，nginx 反代统一入口）：

```bash
docker compose up -d --build
```

启动后浏览器打开 **http://localhost**（nginx 已托管前端并把 `/api` 反代到 Java，无需改 Java CORS）。
各服务健康检查：

- Java：`GET http://localhost/health`（经 nginx）或 `http://localhost:8080/health`
- Python：`GET http://localhost:8000/health`
- 前端：`GET http://localhost/`

默认 **规则模式**（`LLM_ENABLED=false` + `RAG_ENABLED=false`），完全离线可演示。已内置示例数据（商品/库存/订单 + 一条运营计划及 trace），打开即可浏览与「确认/驳回」。

> 接入真实 LLM：本地装好 Ollama 并把 `python` 服务的 `LLM_ENABLED` 改为 `true`（在 `docker-compose.yml` 或 `.env` 中调整），如需 RAG 再把 `RAG_ENABLED=true` 并 `ollama pull nomic-embed-text`。镜像本身不含模型权重。

### 手动四服务启动（本地开发）

若不想用容器，也可按「运行前提」逐服务本地起（PostgreSQL 用 `docker compose up -d postgres`，其余见各小节）。前端开发期由 Vite 把 `/api` 代理到 Java（`:8080`）。

---

## 链路截图指南

为作品集补充截图时，建议在本机跑起全栈后截取以下画面（演示数据已内置，无需先触发编排）：

1. **计划列表**：前端「运营计划」页，展示 seed 的示例计划（状态、需人工审核）。
2. **计划详情**：点开计划，展示四类产出（商品规划 / 图片创意 / 库存采购 / 订单履约）与每个 Agent 的执行 trace（输入 / 输出 / 错误）。
3. **库存预测 / 物流异常**：在计划详情的「库存采购」「订单履约」块中可见 `daily_demand` / `days_to_stockout` / `logistics_risk_level` / `after_sale_suggested` 等增强字段。
4. **确认 / 驳回闭环**：在计划详情点「确认计划」→ 确认状态变为 `CONFIRMED`；点「驳回计划」→ 变为 `REJECTED`（按钮随之禁用）。可截前后对比。
5. **Swagger / 接口**：`http://localhost:8080/docs` 展示 Java REST API；`/api/operation-plans/{id}/confirm`、`/reject` 可在文档内直接试。

---

## 接口清单

### Java 业务 API（base: `http://localhost:8080`）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 健康检查 |
| POST | `/api/products` | 创建商品 |
| GET | `/api/products` | 商品列表 |
| GET | `/api/products/{id}` | 商品详情 |
| PUT | `/api/products/{id}` | 更新商品 |
| DELETE | `/api/products/{id}` | 删除商品 |
| POST | `/api/inventories` | 创建库存 |
| GET | `/api/inventories` | 库存列表 |
| GET | `/api/inventories/{id}` | 库存详情 |
| GET | `/api/inventories/by-product/{productId}` | 按商品查库存 |
| PUT | `/api/inventories/{id}` | 更新库存 |
| DELETE | `/api/inventories/{id}` | 删除库存 |
| POST | `/api/orders` | 创建订单 |
| GET | `/api/orders` | 订单列表 |
| GET | `/api/orders/{id}` | 订单详情 |
| GET | `/api/orders/by-product/{productId}` | 按商品查订单 |
| PUT | `/api/orders/{id}` | 更新订单 |
| DELETE | `/api/orders/{id}` | 删除订单 |
| POST | `/api/operation-plans` | 创建运营计划（Python 写回用） |
| GET | `/api/operation-plans` | 计划列表 |
| GET | `/api/operation-plans/{id}` | 计划详情 |
| GET | `/api/operation-plans/by-trace/{traceId}` | 按 trace 查计划 |
| PUT | `/api/operation-plans/{id}` | 更新计划 |
| DELETE | `/api/operation-plans/{id}` | 删除计划 |
| POST | `/api/operation-plans/{id}/confirm` | 人工确认计划（置 `confirmation_status=CONFIRMED`） |
| POST | `/api/operation-plans/{id}/reject` | 人工驳回计划（置 `confirmation_status=REJECTED`） |
| POST | `/api/agent-runs` | 创建 Agent 执行记录（Python 写回用） |
| GET | `/api/agent-runs` | 记录列表 |
| GET | `/api/agent-runs/{id}` | 记录详情 |
| GET | `/api/agent-runs/by-operation-plan/{operationPlanId}` | 按计划查执行记录 |

### 编排入口（主链路触发点）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/orchestration/generate` | 加载商品/库存/订单 → 调 Python 生成运营计划 |

请求体：`{ "productId": <long>, "orderId": <long>, "triggerType": "MANUAL" }`

### Python 运营计划 API（base: `http://localhost:8000`）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 健康检查 |
| POST | `/agent/ecommerce/operation-plan` | 接收 product/inventory/order 上下文，返回结构化 `OperationPlanResult`，并副作用式写回 Java |

请求体（`OperationPlanRequest`）：`product` / `inventory` / `order` 三个上下文对象 + `trigger_type`。

---

## 端到端小闭环验证

推荐用脚本一次性跑通（自动造数 → 触发 → 校验落库）：

```bash
# 三个服务都起来后
python scripts/demo_e2e.py
```

脚本会：创建 1 个商品 + 1 条库存 + 1 个订单 → 调 `POST /api/orchestration/generate` → 校验 `operation_plans` 写入 1 行、`agent_runs` 写入 5 行（5 个 Agent 各一条，均 `status=SUCCESS`）。

造数后，打开前端 `http://localhost:5173` → 「运营计划」查看计划与每个 Agent 的 trace（输入/输出/错误），即可人工阅读审核。

也可手动复现（见下方示例请求）。

---

## 手动示例请求

> 注意：在 Windows PowerShell 里用 `curl.exe` 内联中文 JSON 易踩坑（反斜杠转义 + GBK/UTF-8 乱码导致 400）。最稳的方式是把 JSON 写文件后用 `curl.exe -d "@file.json"` 发送，或直接使用 `scripts/demo_e2e.py`。

```bash
# 1) 创建商品（status 枚举：DRAFT / ANALYZED / NEEDS_REVIEW）
curl.exe -s -X POST http://localhost:8080/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Wireless Earbuds","category":"Audio","description":"Budget ANC earbuds","costPrice":39.0,"salePrice":99.0,"targetAudience":"students","usageScenario":"commute","status":"ANALYZED"}'

# 2) 创建库存（productId 用上一步返回的 id；status 枚举：ENOUGH / LOW / RISK）
curl.exe -s -X POST http://localhost:8080/api/inventories \
  -H "Content-Type: application/json" \
  -d '{"productId":1,"currentStock":120,"reservedStock":10,"safeStockThreshold":50,"purchaseCycleDays":14,"salesLast7Days":40,"inventoryStatus":"ENOUGH"}'

# 3) 创建订单（status 枚举：PENDING_ANALYSIS / READY_TO_SHIP / INSUFFICIENT_STOCK / NEEDS_REVIEW）
curl.exe -s -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -d '{"productId":1,"quantity":2,"status":"PENDING_ANALYSIS","addressComplete":true,"paid":true,"manualReviewRequired":false,"fulfillmentSuggestionStatus":"PENDING_ANALYSIS"}'

# 4) 触发编排（Java 调 Python）
curl.exe -s -X POST http://localhost:8080/api/orchestration/generate \
  -H "Content-Type: application/json" \
  -d '{"productId":1,"orderId":1,"triggerType":"MANUAL"}'

# 5) 查询结果（Python 已写回 Java）
curl.exe -s "http://localhost:8080/api/operation-plans" | head -c 800
curl.exe -s "http://localhost:8080/api/agent-runs/by-operation-plan/1"
```

---

## 配置项

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/ecommerce_agent` | Java 数据源 |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` | `ecommerce` / `ecommerce_password` | 数据库账号 |
| `python.agent.base-url` | `http://localhost:8000` | Java 调 Python 地址（可用 `PYTHON_AGENT_BASE_URL` 覆盖） |
| `python.agent.connect-timeout-ms` | `10000` | 连接超时 |
| `python.agent.read-timeout-ms` | `120000` | 读取超时（留足多 Agent 串行 LLM 生成时间） |
| `JAVA_API_BASE_URL` | `http://localhost:8080` | Python 调 Java 地址（环境变量覆盖） |
| `LLM_ENABLED` | `true` | 是否启用真实 LLM（见上方「LLM 配置」） |
| `LLM_BASE_URL` | `http://localhost:11434/v1` | OpenAI 兼容端点（Ollama） |
| `LLM_MODEL` | `qwen2.5:latest` | LLM 模型名 |
| `LLM_API_KEY` | `ollama` | LLM API Key |
| `LLM_TEMPERATURE` | `0.3` | 生成温度 |
| `LLM_TIMEOUT_MS` | `30000` | 单次 LLM 调用超时（毫秒） |
| `RAG_ENABLED` | `true` | 是否启用分类知识库 RAG（见上方「分类知识库 RAG」） |
| `RAG_KNOWLEDGE_DIR` | `knowledge` | 知识库目录 |
| `RAG_EMBEDDING_MODEL` | `nomic-embed-text` | 本地 embedding 模型 |
| `RAG_EMBEDDING_BASE_URL` | `http://localhost:11434/v1` | embeddings 端点（默认复用 LLM） |
| `RAG_TOP_K` | `3` | 每类目召回块数 |
| `IMAGE_REVIEW_ENABLED` | `true` | 是否对图片创意方案做本地 LLM 视觉审核（见上方「图片视觉审核」） |

---

## 已知约束与下一步

- 各表 `status` 字段有 CHECK 枚举约束，写数据时需使用合法枚举值（见上文示例）。
- 默认 Agent 为规则实现（显式选择「规则」或部署级 `LLM_ENABLED=false`）；设置 `LLM_ENABLED=true` 且本地 Ollama 就绪（或在设置中心选好其他厂家并填 Key）后，5 个 Agent 走真实 LLM 生成，调用失败直接报错（不再静默降级到规则）。
- **下一步**：单个 Agent 深度增强（真实图片生成 / 库存预测 / 物流售后）、Supervisor 动态路由与人工确认、LangGraph 动态编排。
