# 电商超级个体 · 多 Agent 运营助手

一个面向「电商超级个体」的多 Agent 运营助手，目标为 **大框架、小闭环**。第二期已在稳定主链路之上逐个增强 Agent 真实能力（可插拔多厂家 LLM 编排、分类知识库 RAG、LLM 图片视觉审核、库存需求预测、物流异常 + 售后联动、Supervisor 动态路由与失败重试、前端人工确认/驳回闭环）。

- **Python 多 Agent 服务**：Supervisor 编排 4 个业务 Agent（选品规划 / 图像创意 / 库存采购 / 订单履约）结构化输出运营计划；另有 2 个监控 Agent（库存预警 `InventoryMonitorAgent` / 订单复核 `OrderMonitorAgent`，线2）。
- **Java Spring Boot 业务服务**：PostgreSQL 落库，提供商品 / 库存 / 订单 / 运营计划 / Agent 执行记录等 REST API。
- **Java ↔ Python 双向 HTTP 闭环**：Java 编排入口加载业务数据并调用 Python 生成计划；Python 生成后通过 Tool API 把计划与执行明细写回 Java。

> **本地优先**：不接真实电商 / 支付 / 物流业务 API（用模拟数据演示）。图片生成可接真实 DashScope 万相（可选）。真实 LLM 走**设置中心可配置的多厂家后端**（通义千问 / DeepSeek / Kimi / 智谱 / OpenAI / Gemini / 本地 Ollama 等，可选）；关闭或选「规则」模式时走确定性规则实现，主链路不中断。前端通过 Docker Compose 内 nginx 反代访问 Java，无需改 Java CORS。
>
> **订单数据同样「模拟 ↔ 真实」可切换**：`DATA_SOURCE=mock`（默认）由本地造数，产出与真实平台拉单**完全同构**的订单（同样带平台单号 / 收件人 / 金额 / 物流）；切到 `real` 后 Java 经 Python 平台适配器调各平台开放 API 取单，库表结构、Agent 逻辑、前端页面都不用改——用户只需在设置中心填好平台凭证即可无缝切换。

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
│       ├── agents/             # supervisor + 4 业务 agent + 2 监控 agent（InventoryMonitorAgent / OrderMonitorAgent）
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
| 0 | 接入可插拔多厂家 LLM | 5 个 Agent（Supervisor + 4 业务 Agent）结构化输出复用 Pydantic Schema；LLM 由设置中心运行时切换厂家（通义千问/DeepSeek/本地 Ollama 等）；LLM 调用失败直接报错（不静默降级到规则），由前端弹窗提示；关闭或选「规则」模式时显式走确定性规则实现 |
| 0.5 | 前端只读 SPA | React + Vite，查看计划/四类产出/Agent trace/商品库存订单 |
| 1 | 商品规划增强 | SEO 关键词 + 淘宝/抖音/小红书多平台文案 |
| 2 | 分类知识库 RAG | 本地 Markdown 知识库 + 内存 Chroma 向量检索，注入商品/图片 Agent（可选，关 RAG 不影响主链路） |
| 3 | 图片视觉审核 | 已配置的 LLM 对创意方案做合规/质量审核，产出 `image_review_result`（可选，关则走规则启发式） |
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

### 5. 设置中心（运行时可配置，持久化到 settings.json）

前端「设置」页把所有原先散落在 `.env` 的开关 / 模型选择集中管理，修改后**持久化到 `python-agent-service/data/settings.json`**（已 gitignore），重启后保留。**设置中心优先于同名环境变量**；环境变量仅在未配置设置中心时作兜底默认值。

设置中心共 **4 张模型卡 + 2 张独立非 LLM 卡**：

| 卡片 | 用途 | 是否 LLM | 说明 |
| --- | --- | --- | --- |
| 文案生成（LLM） | 写文案 / 写提示词 | 是 | 文本大模型，多厂家 OpenAI 兼容 |
| 商品图片生成（出图） | 真实出图（文生图 / 图生图） | 是（独立模型） | qwen-image，与文本 LLM 互不相干 |
| 视频生成 | 生成宣传短视频 | 是（独立模型） | 万相 / 欢乐马等 |
| 库存监控（监控模型） | 线2 库存智能预警 | 可选 | 关闭 / 未配 Key 时按可售天数红线降级，不报错 |
| **订单监控（地址复核）** | 线2 订单维度复核 | **否** | 独立非 LLM 配置：`mode`（demo/real）+ 演示通过率滑条 |
| **平台对接（订单数据源）** | 配置真实平台凭证 + 切换拉单来源 | **否** | 各平台 `app_key` / `app_secret` / `endpoint` / 店铺 ID / 授权令牌；`simulatePull` 开关决定 `DATA_SOURCE`（模拟造数 / 真实拉单）。**平台密钥只存在此处**，Java 不持有 |

各卡片**互不借用**：每张卡片的 Key / 模型 / base_url 只来自本卡片，不回退其他卡片、不读 `.env`（环境变量的兜底默认值见下文与各能力小节）。前端据厂家的模型目录渲染下拉，`base_url` 由厂家+模型派生（仅 custom 允许手填）。

> 本地起 Ollama 作为后端（可选）：
> ```bash
> ollama pull qwen2.5:latest
> ollama list
> ```
> 在设置中心 LLM 卡片选「Ollama（本地）」并填 `http://localhost:11434/v1` 即可，无需 Key。

Agent 的 LLM 由**设置中心（前端「设置」页）运行时配置并持久化**，支持多厂家 OpenAI 兼容后端：

- 云端：通义千问（DashScope，默认 fallback 厂家）、DeepSeek、Kimi（月之暗面）、智谱 GLM、OpenAI、Gemini
- 本地：Ollama（无需 API Key，端点 `http://localhost:11434/v1`）
- 其他：自定义 OpenAI 兼容端点；以及「规则模式」（确定性输出，不调用任何 LLM）

未启用 LLM 或选「规则模式」时，Agent 显式走确定性规则实现，主链路不中断、可离线演示。

环境变量为**兜底默认值**（未配置设置中心时使用），默认指向本地 Ollama 兼容端点：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `LLM_ENABLED` | `true` | 是否启用真实 LLM；设为 `false` 则全部退回规则实现。 |
| `LLM_BASE_URL` | `http://localhost:11434/v1` | OpenAI 兼容端点兜底默认值（指向 Ollama 的 `/v1`）；设置中心配置优先。 |
| `LLM_MODEL` | `qwen2.5:latest` | 兜底默认模型名。 |
| `LLM_API_KEY` | `ollama` | Ollama 无需真实 key，填任意值；云端厂家请在设置中心填写真实 Key。 |
| `LLM_TEMPERATURE` | `0.3` | 生成温度。 |
| `LLM_TIMEOUT_MS` | `120000` | 单次调用超时（毫秒）。 |

- 结构化输出直接复用 Agent 的 Pydantic Schema，Java 落库契约不变。
- 切换厂家：在设置中心 LLM 卡片选择厂家与模型即可，代码无需改动（所有厂家统一走 OpenAI 兼容客户端）。

### 6. 分类知识库 RAG（可选，横向赋能）

商品规划（Product Planning）与图片创意（Image Creative）两个 Agent 会检索「分类知识库」并把命中内容注入 prompt，使产出引用平台规则、违禁词与 SEO 建议。知识库为本地向量检索（可配置 embedding 端点 + 内存 Chroma，兜底默认指向本地 Ollama 兼容 `/v1`），**不改 Java/Postgres，Python 仍不持库、可独立运行**。

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

启用步骤（需一个 embedding 端点，兜底默认指向本地 Ollama 兼容 `/v1`）：

```bash
ollama pull nomic-embed-text   # 本地 embedding 模型（也可换任意 OpenAI 兼容 embeddings 端点）
```

Python 服务通过环境变量控制（默认值即开启，关闭后行为与改造前完全一致）：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `RAG_ENABLED` | `true` | 关闭后不检索知识库，Agent 行为与改造前一致（容器化部署默认 `false`）。 |
| `RAG_KNOWLEDGE_DIR` | `knowledge` | 知识库目录（相对 `python-agent-service/`，或绝对路径）。 |
| `RAG_EMBEDDING_MODEL` | `nomic-embed-text` | embedding 模型名（默认指向本地 Ollama 模型，可换任意 OpenAI 兼容 embeddings）。 |
| `RAG_EMBEDDING_BASE_URL` | `http://localhost:11434/v1` | embeddings 端点兜底默认值，复用 LLM 的 Ollama `/v1`；设置中心配置优先。 |
| `RAG_TOP_K` | `3` | 每个类目召回的块数。 |
| `RAG_CHUNK_SIZE` / `RAG_CHUNK_OVERLAP` | `500` / `50` | 切块参数（可选）。 |

- 检索结果会写入 `PRODUCT_PLANNING_AGENT` 的运行轨迹 `input_json.retrieved_knowledge`，前端「运行详情」可直接查看注入了哪些知识。
- 优雅降级：RAG 关闭 / 嵌入模型不可用 / 检索异常时返回空知识串，主链路不中断。

### 7. 图片视觉审核（可选，全本地）

Image Creative Agent 在生成图片创意方案后，会用**已配置的 LLM**（设置中心所选厂家）对方案做一次独立「视觉合规/质量审核」，产出结构化结果：

```json
{
  "overall_score": 92,
  "risk_level": "低风险",
  "issues": [],
  "suggestions": ["可直接使用"],
  "reviewer": "llm"
}
```

- 审核复用已配置的 LLM（与生成同一套设置中心配置），**不接外部图片生成 API、不引 key、无费用**。
- 审核结果随 `ImagePlan.image_review_result` 一并返回，并写入 `IMAGE_CREATIVE_AGENT` 的运行轨迹 `output_json`，前端「运行详情」图片创意块与 trace 自动可见。
- 关闭 `IMAGE_REVIEW_ENABLED=false` 后不再产出审核字段，行为与改造前一致。
- 优雅降级：审核 LLM 调用失败时不丢弃已生成的创意方案，审核结果置为 `null`；LLM 关闭（规则路径）时走确定性启发式审核（`reviewer="rule"`）。

Python 服务通过环境变量控制：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `IMAGE_REVIEW_ENABLED` | `true` | 关闭后不产出图片审核结果。 |

- LLM 调用失败（如端点不可达、Key 缺失、模型不存在）：Supervisor 先重试 1 次，仍失败则**直接报错**（422 中文可读），由前端弹窗提示，**不再静默降级到规则实现**；失败的 Agent 在 `agent_runs` 中标记为 `FAILED` 并写入 `errors`。
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

> 接入真实 LLM：在运行后打开前端「设置」页，于 LLM 卡片选择厂家与模型（通义千问 / DeepSeek / 本地 Ollama 等）并填写 Key（Ollama 本地免 Key），保存即生效；也可在 `docker-compose.yml` 或 `.env` 中调整 `LLM_ENABLED` / `RAG_ENABLED`。镜像本身不含模型权重，RAG 需本地 `ollama pull nomic-embed-text` 或任意 OpenAI 兼容 embeddings 端点。

### 手动四服务启动（本地开发）

若不想用容器，也可按「运行前提」逐服务本地起（PostgreSQL 用 `docker compose up -d postgres`，其余见各小节）。前端开发期由 Vite 把 `/api` 代理到 Java（`:8080`）。

---

## 地址补全复核（订单监控 Agent 审核落点）

订单详情页点「确认地址已补全」**不再是盲目信任操作**：`OrderController.completeAddress` 先调用 Python 侧 **`OrderMonitorAgent`**（线2 订单监控 Agent）向订单来源复核地址是否真已补全，再决定后续流程。监控逻辑完全在 Python Agent，Java 只负责编排与落库。

- 复核**未通过** → Python 返回 `verified=false`，Java 直接返回 `409` + 可读原因，前端弹窗提示，**不翻转 `addressComplete`、不改订单状态**（即"还是没填就弹提示"）。
- 复核**通过** → 置 `addressComplete=true`，调 Python 重算履约结论，并**同时流转订单主状态 `status`**（之前创建后永不变）：可发货→`READY_TO_SHIP`，仍缺库存→`INSUFFICIENT_STOCK`，其余→`NEEDS_REVIEW`。

### 两个监控 Agent（线2）

| Agent | 类型 | 职责 |
| --- | --- | --- |
| `InventoryMonitorAgent` | 预测型 | 基于真实日销 + LLM 未来事件，估算可售天数并预警（< 5 天 WARN） |
| `OrderMonitorAgent` | 核验型 | 订单维度复核（当前为地址补全复核），向订单来源确认状态是否真已达成 |

两者各管一摊，均属线2 监控，入口分别在 `line2.py` 的 `/line2/inventory-warnings` 与 `/order-monitor/verify`。

### 演示态随机机制（⚠️ 生产须移除）

本机/演示默认 `ORDER_MONITOR_MODE=demo`，由 `OrderMonitorAgent` **随机模拟平台同步复核的通过/拦截**（通过率由 `ORDER_MONITOR_DEMO_SUCCESS_RATE` 控制，默认 `0.5`）。这样点一次可能成功（状态流转）、也可能失败（弹窗拦截），用于演练监控 Agent 的两条分支。

> 真实平台往往只返回「地址是否完整」标记（而非明文详细地址，且常加密），本系统也只跟踪该布尔，不存明文地址。因此演示态用随机机制替代"平台同步"，无需人工录入虚拟地址。

### 上生产：切换到真实复核

1. 将 `ORDER_MONITOR_MODE` 置为 `real`。
2. 在 `OrderMonitorAgent._verify_real` 中接入对应开放平台订单详情接口，读取收件人地址完整标记（`address_complete`）：
   - 淘宝/天猫：`taobao.trade.fullinfo.get` / `taobao.orders.detail.get`
   - 抖音电商（抖店）：`order.orderDetail`
   - 小红书：订单详情接口
3. 确认无误后删除演示态随机分支（保留 `real` 实现即可）。

配置项：**优先在设置中心「监控模型设置 → 订单监控（地址复核）」卡片配置**（`mode` 下拉 + 演示通过率滑条，保存即持久化）。以下环境变量仅为**兜底默认值**（设置中心未配置时生效）：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `ORDER_MONITOR_MODE` | `demo` | `demo`=随机模拟；`real`=生产态，须实现平台校验 |
| `ORDER_MONITOR_DEMO_SUCCESS_RATE` | `0.5` | 演示态随机通过率（仅 demo 生效） |

---

## 订单数据来源（模拟 ↔ 真实）

平台订单是整条履约链路的源头。为让系统在「没接平台」时也能完整演练、又能在「接上平台」后零改动切换，我们把"订单从哪来"收敛成一个 `OrderSource` 接口：

```java
public interface OrderSource {
    String name();                                // mock / real，会写进 orders.source
    List<PulledOrder> pull(OrderPullCommand cmd); // 只产出「事实」，不决定状态
}
```

两种来源**只产出事实**（是否已付款 `paid`、地址是否完整 `addressComplete`、平台是否标记需复核 `manualReviewRequired`、收件人/金额/物流等结构化字段），业务状态由 Java 侧 `SimulationService.deriveStatus` 按**同一套规则**统一推导：

| 事实组合 | 推导状态 |
| --- | --- |
| 库存不足（运行库存 < 下单量） | `INSUFFICIENT_STOCK` |
| `manualReviewRequired` | `NEEDS_REVIEW` |
| `!paid \|\| !addressComplete` | `PENDING_ANALYSIS` |
| 其余（已付款 + 地址完整 + 无需复核） | `READY_TO_SHIP` |

由此 mock 与 real 两条路径落到 `orders` 里的行**完全同构**——下游 Agent、库存联动、日销聚合、前端页面都不感知数据来源，切换来源无需改动任何下游代码。

### 模拟来源（默认）

`MockOrderSource`（`DATA_SOURCE=mock`）本地造数，按同样的「约 70% 可发 / 15% 待分析 / 15% 需复核」分布生成订单，并带平台单号、收件人（抖音 / 小红书按平台加密）、金额、物流等真实订单会有的字段。造数**不判断库存、不决定状态**——库存不足由运行库存实时推导，避免"明明有货却显示库存不足"的误导。

### 真实来源（接平台）

`RealOrderSource`（`DATA_SOURCE=real`）本身不持有任何平台密钥：Java 只把"要哪些已确认计划、最近几天"发给 Python（`POST /agent/ecommerce/platform/pull-orders`），**平台凭证与协议翻译全部在 Python 侧**（见 `python-agent-service/app/platform/`，`PlatformAdapter` 抽象）。Python 返回平台中立的 `PlatformOrder` 列表，Java 在同一事务内落库。

**失败闭合**：某平台未对接 / 凭证缺失时，Python 把中文原因放进 `warnings`；若一个平台都没拉成，Java 直接报中文错误给用户（**不静默回退到模拟数据**），前端弹窗提示"该去哪补什么"。

> ⚠️ **平台适配器当前为脚手架（scaffold）**：各 `PlatformAdapter` 实现尚未对接真实开放 API，未配置时会抛出中文 `ConfigError`（原样进入 `warnings`）；接好对应平台 `list_orders` 实现即可上线，Java 与前端无需改动。

### 幂等去重

`orders` 表对 `(platform, platform_order_id)` 建唯一索引。真实来源重复同步时，已存在的平台单号直接跳过（不重复落库）；模拟来源每批单号带时间戳 + 自增序号，天然不冲突。

### 前端切换

前端「模拟器」页在加载时调 `GET /api/simulation/data-source`：返回 `source=mock` 时展示"平台模拟"（本地造数演示）；返回 `source=real` 且带已对接平台列表时，切换为"平台订单同步"界面，列出已对接平台并拉取最近订单。

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
| POST | `/api/simulation/pull-orders` | 按已确认计划拉取平台订单（mock 本地造数 / real 调 Python 拉真实平台单） |
| GET | `/api/simulation/data-source` | 当前订单数据来源（`{source: mock\|real, platforms: [...]}`），前端据此切换模拟/同步界面 |
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
| POST | `/agent/ecommerce/platform/pull-orders` | 按平台分组调 `PlatformAdapter` 拉真实订单，返回平台中立 `PlatformOrder` 列表（Java 落库，Python 不持库） |
| GET | `/agent/ecommerce/platform/status` | 各平台对接就绪情况（`ready` 列表：凭证齐全、可正常拉单的平台） |

请求体（`OperationPlanRequest`）：`product` / `inventory` / `order` 三个上下文对象 + `trigger_type`。

`POST /agent/ecommerce/platform/pull-orders` 请求体：`plans`（每项 `platform` / `plan_id` / `product_id` / `product_name` / `platform_item_id`）+ `since_days`。返回：`orders` / `platforms` / `warnings`。

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
| `DATA_SOURCE` | `mock` | 订单数据来源：`mock`=本地造数（默认，演示用）；`real`=经 Python 调平台开放 API 拉真实订单（需先在设置中心填平台凭证） |
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
| `IMAGE_REVIEW_ENABLED` | `true` | 是否对图片创意方案做已配置 LLM 视觉审核（见上方「图片视觉审核」） |

---

## 已知约束与下一步

- 各表 `status` 字段有 CHECK 枚举约束，写数据时需使用合法枚举值（见上文示例）。
- 默认 Agent 为规则实现（显式选择「规则」或部署级 `LLM_ENABLED=false`）；在设置中心选好厂家并填 Key（或本地 Ollama 就绪）后，4 个业务 Agent 走真实 LLM 生成，调用失败直接报错（不再静默降级到规则）。2 个监控 Agent 中 `InventoryMonitorAgent` 可选 LLM、 `OrderMonitorAgent` 为非 LLM 核验（演示随机 / 真实平台校验）。
- **下一步**：单个 Agent 深度增强（真实图片生成 / 库存预测 / 物流售后）、Supervisor 动态路由与人工确认、LangGraph 动态编排。
