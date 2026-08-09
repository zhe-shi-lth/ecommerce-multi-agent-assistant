# 电商超级个体多 Agent 运营助手 — 总体计划（开发指导基线）

> **本文是项目唯一规划文档。** 它合并了原 `目标计划`、`数据表与 API 确认规则`、`第一期实施计划`、`第二阶段计划表`、`PROJECT_BLUEPRINT`、`FRONTEND_BLUEPRINT` 的全部内容，是后续开发的唯一权威依据。
> 旧规划/蓝图/spec 文档已收敛删除；`docs/learning/`（学习笔记）与 `docs/interview.md`（面试讲解）为补充资料，不属本计划。
> 最近一次更新：2026-07-12（目录优先、品类管理、阶段 0–10 全部完成，待归档）。

---

## 0. 如何使用本文

- **定位**：指导开发的"完整路径"基准。讲清"做什么 / 不做什么 / 怎么做 / 做到哪了"。
- **推进方式**：以完成度为主线，小步推进；每完成一个阶段/步骤更新「第九章 完成状态」与记忆。
- **变更纪律**（见第十一章）：改动前先说明；不主动 `git commit`/`push`；新表/新 API 先过"五问"。

---

## 一、项目定位与目标

### 1.1 是什么
面向**真实个体店主**的 AI 运营助手（真实产品，非展示型）。个体店主把上新品最耗时的脑力活交给一组 AI Agent 协同完成：
- **上新品时**：AI 写多平台文案、生成商品图、过合规审核，店主审核后一键发布。
- **日常经营中**：AI 盯库存该补货没、每笔订单发货前有没有物流风险（线二）。
- 所有 AI 产出**结构化、可人工审批、可落库、可追溯**，人始终是最后拍板者。

**项目本质（简历表达）**：以 Python 构建多 Agent 协同层（商品运营/图片创意/库存补货/订单履约/流程总控），以 Java Spring Boot 提供商品/库存/采购/订单/出货等业务 API，实现从商品录入到运营建议、补货判断、出货判断与 Agent 执行记录落库的完整闭环。

### 1.2 就业目标
- Java 后端工程师（具备 AI Agent 工程化能力）；AI 应用开发工程师（具备企业系统集成经验）。
- 复用方向：电商 SaaS、跨境电商、智能客服、运营自动化、AI Agent 应用开发。

### 1.3 核心设计原则（贯穿全程，不可破）
1. **人机协同，人审闭环**：AI 生成 → 人审批（通过/驳回）→ 发布，绝不替人自动发布。
2. **大框架、小闭环**：先打通端到端最小链路，再逐个增强 Agent 真实能力。
3. **本地优先、优雅降级**：LLM / 外部 API 挂了就降级到规则实现，主链路不中断。
4. **落库契约稳定**：扩展字段向后兼容，Java 侧通用 `Map`/`json` 承载 Agent JSON。
5. **轻薄前端**：React SPA 只调 Java REST（线1 走 `/agent` 经代理），不引重型 UI 库、不接登录鉴权。

### 1.4 平台策略（已与用户确认）
- **三平台同步推进**：小红书 / 淘宝 / 抖音都是线一正式目标平台，不再做"小红书优先、淘宝/抖音灰显留位"。
- **当前交互为单次选择一个目标平台**：一次上架流程绑定一个平台，文案、图片、视频、运营计划与后续订单来源均以该平台为准；同一商品要上多个平台时，可分别发起多次上架流程。
- **目标是 API 接入后可直接使用**：线一保留平台字段、平台文案、平台订单来源和发布闸门；后续补齐各平台发布适配器后，应直接复用现有上架计划与人审闭环。
- 文生图 / 图生图 / 图生视频 / 三平台真发布是核心路线（必做），不再视为"可延后"。

---

## 二、总体架构

系统按"三层 + 双向闭环"组织：

| 层 | 技术 | 职责 |
|---|---|---|
| 前端 | React + Vite + TS（SPA） | 上架向导 + 只读浏览 + 审批交互；只调 Java REST，dev 走 Vite proxy，生产走 nginx 反代 |
| 业务/落库 | Java Spring Boot 3.x + PostgreSQL（Flyway） | 商品/库存/订单/计划/执行 trace/销售/收藏/品类 的 CRUD 与确认 |
| 智能层 | Python（FastAPI + LangChain-Ollama） | 5 个 Agent 编排、RAG、结构化输出；被 Java 调用，也直接对前端暴露线1 端点 |
| 编排 | Java `OrchestrationController` ↔ Python `POST /agent/ecommerce/operation-plan`；Python `JavaApiClient` 回写落库 | 双向 HTTP 闭环，全程 `trace_id` |

**技术边界原则**
- Python 多 Agent 是主线，Java 是企业业务系统载体。
- Agent 不直接操作数据库，一律经 Java API（Tool API）读写。
- 先做同步 HTTP 闭环，后续再考虑消息队列/异步。
- 每个 Agent 必须有明确输入、结构化输出、执行记录。

**技术栈**：Java 21 / Spring Boot 3.x / Spring Data JPA / PostgreSQL / Flyway / Maven；Python 3.11+ / FastAPI / Pydantic v2 / LangChain（OpenAI 兼容，指向本地 Ollama）/ HTTPX / pytest / loguru / uv；Docker Compose 本地编排；`.env` 管理环境变量。

**仓库结构**
```
ecommerce-multi-agent-assistant/
  docs/                 # PLAN.md（本文件）、learning/、interview.md
  python-agent-service/ # app/{api,agents,schemas,services,tools,rag,tracing}
  java-service/         # src/main/java/com/lth/ecommerceagent + resources/db/migration
  frontend/             # React SPA
  docker-compose.yml
  README.md
```

---

## 三、业务线划分

系统按"两条业务线"组织，对应卖家真实运营节奏：

### 线一：上架流水线（用户主动、顺序门控）★ 当前重点
**目录优先流程（2026-08-09 当前实现）**：用户在「商品」tab 选择一个已建商品 + 选择一个目标平台（小红书 / 淘宝 / 抖音均可选）→ 后端按商品 id 从 Java 拉真实数据喂 Agent，不再手填想法（修掉原 `NewProductIdea` 别名漏字段触发 `products` NOT NULL 500）。
1. **选商品+平台**（Step 0，单商品 + 单目标平台；多平台上架通过多次流程完成）。
2. **商品文案生成**（ProductPlanningAgent）：标题、卖点、详情、SEO 词、按选中平台生成对应文案（含平台文案归一化）；可注入分类知识库（RAG）。
3. **图片生成**（ImageCreativeAgent）：主图/场景图/营销图提示词 + 风格；附视觉合规审核；出图 Key 未配置时前端直接拦截提示，不生成假图片/占位结果。
4. **人审 → 发布 / 导出**：
   - **发布**：审核通过后一键发布到当前选中的平台（小红书 / 淘宝 / 抖音均为正式目标；M3 补齐三平台发布适配器）。
   - **导出**：纯导出功能（复制文案到剪贴板），不触发发布，随时可用。

### 线二：日常监控（系统自动、事件触发，走 Supervisor 编排）
- **库存与采购**（InventoryPurchaseAgent）：基于日销的确定性预测——日均需求、预计售罄天数、建议补货量、风险等级；LLM 只补文案理由。
- **订单履约**（OrderFulfillmentAgent）：发货前物流风控——未付款/地址不全/库存不足/大单分批/需人工复核 → 风险等级 + 异常明细 + 处理建议 + 售后联动建议。
- **动态路由**：Supervisor 按 `trigger_type` 条件派发（默认全量，演示分支 `INVENTORY_REVIEW` 仅库存+履约）。

### 横向能力（赋能所有 Agent）
- **分类知识库 RAG**：Markdown 分品类沉淀（平台规则/违禁词/SEO），本地向量检索注入 prompt，无命中则优雅降级。
- **LLM / 出图 / 视频真实能力优先**：文案、图片、视频能力未配置 Key 时前端直接拦截提示；不为这些生成型能力返回假数据。确定性规则仅用于库存预测、履约风控等非生成型业务判断，保证业务硬决策可离线运行。

### 结果消费与回流
- **运营计划详情**：四块 Plan JSON（商品/图片/库存/履约）+ 总结 + 每 Agent 执行 trace（input/output/error 全留痕）。
- **人工确认闭环**：计划可 `confirm` / `reject`，落库 `confirmation_status` / `confirmed_at`。
- **按平台导出**：详情页一键导出小红书/淘宝/抖音格式文案 + 复制（纯导出）。
- **收藏复用**：优秀文案可收藏到 `favorite_copies`，收藏夹可复制/删除。
- **销售监控**：日营业额/销量 SVG 折线图 + 库存水位条（数据来自 `daily_sales`）。

---

## 四、数据模型与落库契约

### 4.1 表清单（Flyway 迁移）
| 表 | 迁移 | 用途 |
|---|---|---|
| `products` | V1 | 商品基础信息（`category` 暂为自由文本，非外键） |
| `inventories` | V1 | 库存水位（当前/预留/安全阈值/采购周期/7日销/状态） |
| `orders` | V1 | 订单（数量/状态/已付/地址完整/履约建议） |
| `operation_plans` | V1 + V2 + V6 | 运营建议（四块 `*_plan_json` + `final_summary` + `status` + `confirmation_status`/`confirmed_at` + `line` 列；`order_id` 可空以支持线1） |
| `agent_runs` | V1 | 每 Agent 执行记录（trace_id/input_json/output_json/status/duration_ms/error） |
| `categories` | V7 | 品类基础数据（MVP 只增+列表，不做删除） |
| `daily_sales` | V5 | 日销（销售监控数据源，当前为种子） |
| `favorite_copies` | V4 | 收藏文案（标签/来源/内容） |

### 4.2 落库契约稳定原则
- Agent 产出以结构化 JSON 落库到各 `*_plan_json`（Java 侧 `json`/`Map` 类型承载），扩展字段向后兼容。
- 新增 Agent 字段：Python Schema 加默认值（向后兼容），Java 侧 Map 零改动，前端 `JsonView` 自动渲染。
- 迁移只加列/加表，不破坏已有数据；线1 落库不复用"建商品"，只挂计划到已有商品。

---

## 五、API 边界

### 5.1 三组 API
1. **业务 API（前端/用户 → Java）**：`/api/products`、`/api/inventories`、`/api/orders`、`/api/operation-plans`、`/api/categories`、`/api/daily-sales`、`/api/favorite-copies`。
2. **Agent API（Java → Python）**：`POST /agent/ecommerce/operation-plan`（Supervisor 统一入口，线二）。
3. **线1 Agent API（前端 → Python）**：`POST /agent/ecommerce/line1/product-plan`、`/line1/image-plan`、`/line1/finalize`（目录优先，入参=商品 id + 选中平台）。
4. **Tool API（Python → Java）**：`GET /api/products/{id}`、`POST /api/operation-plans`、`POST /api/agent-runs` 等（Python 写回落库）。

### 5.2 关键终端清单
| 动作 | 端点 |
|---|---|
| 商品 列表/详情/新建 | `GET/POST /api/products`、`GET /api/products/{id}` |
| 品类 列表/新建 | `GET/POST /api/categories` |
| 库存 列表/新建 | `GET/POST /api/inventories` |
| 订单 | `GET/POST /api/orders` |
| 计划 列表/详情/确认/驳回/导出 | `GET /api/operation-plans`、`GET /api/operation-plans/{id}`、`POST /{id}/confirm|reject`、`GET /{id}/export?platform=` |
| 收藏 | `GET/POST/DELETE /api/favorite-copies` |
| 销售 | `GET /api/daily-sales` |
| 线二分析（Java→Python） | `POST /agent/ecommerce/operation-plan` |
| 线1 文案/图片/落库 | `POST /agent/ecommerce/line1/product-plan|image-plan|finalize` |
| 线1 发布（M3） | `POST /api/operation-plans/{id}/publish-xhs`（待新增） |

### 5.3 API 设计约束
- 跨服务请求携带/返回 `trace_id`；所有 Agent 输出结构化。
- 第一阶段不做：DELETE、批量导入、复杂分页/搜索、登录鉴权、支付/退款/物流/售后/店铺授权/图片生成 API（后续按阶段加）。
- 新增表/API 先过第十一章"五问"。

---

## 六、Agent 设计

5 个 Agent，集中式 Supervisor 编排（子 Agent 不互相直接对话）：

| Agent | 定位 | 第一期轻量输出 | 增强后 |
|---|---|---|---|
| **Supervisor** | 流程总控 | 固定顺序编排 4 子 Agent、汇总、生成 `final_summary`、标 `manual_review_required`/`errors`；建 `trace_id` | 动态路由（trigger_type→步骤表）、LLM 失败重试1次再降级规则 |
| **ProductPlanning** | 商品运营规划 | 标题/卖点/详情/上架建议 | SEO 词、多平台文案（`platform_copies`）+ 平台文案归一化、RAG 知识注入、`selected_platforms` |
| **ImageCreative** | 产品图创意 | 主图/场景图/营销图提示词 + 风格 + 风险提示 | 本地视觉合规审核（`image_review_result`）；M1 真出图 |
| **InventoryPurchase** | 库存与采购 | 阈值规则补货建议 | 确定性销量预测（日均需求/售罄天数/建议补货量/风险等级），LLM 仅写 reason |
| **OrderFulfillment** | 订单履约 | 库存/地址/付款风险判断 | 确定性物流风控（未付款/地址不全/库存不足/大单分批/需复核）→ 风险等级+异常明细+处理建议+售后联动 |

**失败处理**：每个 Agent `try/except` 记入 `errors` 并降级到规则实现，主链路不中断；`agent_runs` 落 `input_json`/`output_json`/`status`/`error`。

---

## 七、前端页面蓝图

**侧边栏（7 tab，不合并不新增）**：新品上架 `/new-listing`（首位/首页）· 运营计划 `/operation-plans` · 商品 `/products` · 库存 `/inventories` · 订单 `/orders` · 销售监控 `/dashboard` · 收藏夹 `/favorites`。销售监控不合并运营计划；监控页顶部加轻量"待办/预警"条（待审计划 + 低库存，点击跳转）。

**通用组件（自写，不引第三方 UI 库）**：`JsonView`（递归渲染 JSON）、`step-bar`（步骤进度条）、`platform-select`（小红书 / 淘宝 / 抖音均可选，单次流程绑定一个平台）、`product-select`（选择单个商品，可按品类筛选）、`confirm-actions`（通过/驳回）、`LineChart`（手写 SVG 折线图）、`client.ts`（`api.get/post`）、`types.ts`（统一 `Json`）。各页统一 `loading`/`empty`/`error` 占位。

**逐页**
| 路由 | 页面 | 核心区块 |
|---|---|---|
| `/operation-plans` | 运营计划 | 列表（ID/Trace/商品/订单/状态/待审/创建时间）；行点击进详情 |
| `/operation-plans/:id` | 计划详情+审批 | 状态徽标 + 确认/驳回；按平台导出+收藏；四块 Plan JSON；可折叠 Agent trace |
| `/new-listing` | 新品上架（线1，目录优先） | `step-bar`：①选商品+平台 ②上传参考图+图片要求 ③图片审批 ④文案审批 ⑤AI 出视频 ⑥完成上架；单商品单平台处理；通过/驳回门控；完成后落运营计划，发布闸门由计划详情确认触发 |
| `/products` | 商品（含品类管理） | 品类管理区块（列表+添加）；商品表格；新建表单（类目下拉=品类列表） |
| `/inventories` | 库存 | 库存表格；新建表单（选商品+当前库存+安全阈值） |
| `/orders` | 订单 | 订单表格（数据底座，待线二前端化加"发货风控台"） |
| `/favorites` | 收藏夹 | 文案卡片（标签/来源/内容）；复制/删除 |
| `/dashboard` | 销售监控 | 待办/预警条 + 两张 LineChart（营收/销量近14天）+ 库存水位表 |

---

## 八、阶段计划（从头到尾）

### 8.1 第一期：大骨架 · 小闭环（已完成）
**目标**：5 个 Python Agent 全部参与一次完整业务流，经 Java 业务系统保存商品/库存/订单/运营建议/执行记录。
**策略**：5 Agent 全部存在、能力先轻量（规则/模板/轻量 LLM）、不接真实大模型/电商/支付/物流/图片。
**不做**：真实电商 API、支付退款售后、真实物流、真实图片生成、多店铺多平台多租户、复杂权限、完整前端后台、消息队列、K8s、复杂预测模型、复杂搜索分页删除 API。
**业务闭环**：商品录入 → Agent 运营分析 → 库存补货建议 → 订单出货建议 → 结果落库。
**推荐开发顺序**：① Python 多 Agent 原型 ② FastAPI 服务化 ③ Java 最小业务系统 ④ Postgres+Flyway ⑤ Java 业务 API ⑥ Java 调 Python ⑦ Python 调 Java Tool API ⑧ 端到端小闭环 ⑨ README+演示数据。
**Task 拆分（已完成）**：T1 Python 骨架 / T2 Pydantic Schema / T3 5 Agent 轻量实现 / T4 Agent API(`/operation-plan`) / T5 Java 骨架 / T6 Docker+PG / T7 Flyway 5 表 / T8 Entity+Repo+DTO / T9 业务 Controller / T10 Java 调 Python(`PythonAgentClient`) / T11 Python 调 Java(`JavaApiClient`) / T12 端到端小闭环验证 / T13 README+演示数据。
**完成标准（全部达成）**：5 Agent 参与完整执行、结构化 JSON 输出、Java 5 表 + 业务 API、Python Agent API、Java↔Python 双向 HTTP 闭环、PG 落库、示例数据跑通、README 可启动。

### 8.2 第二期：Agent 增强 + 作品化 + 用户流程重构 + 目录优先
| 阶段 | 名称 | 目标 | 关键决策 | 状态 |
|---|---|---|---|---|
| 0 | LLM 打底 | 5 Agent 接真实 LLM + 明确拦截 | 文案/图片/视频缺 Key 时前端提示配置，不生成假数据；结构化输出复用 Schema | ✅ |
| 0.5 | 前端只读 SPA | 人工阅读审核入口 | React+Vite+TS；Vite proxy `/api` | ✅ |
| 1 | ProductPlanning 增强 | 平台化文案+SEO | 扩展 `ProductPlan`，Java 落库零改动 | ✅ |
| 2 | 分类知识库 RAG | 检索增强 | Markdown 分品类 + 本地向量（nomic-embed-text + 内存 Chroma）；不落盘 | ✅ |
| 3 | ImageCreative 增强 | 本地视觉审核 | 本地 LLM 合规审核 `image_review_result`；全本地不引外部 | ✅ |
| 4 | Inventory&Purchase 增强 | 库存预测+采购 | 确定性预测为唯一决策源，LLM 仅写 reason；不扩历史字段 | ✅ |
| 5 | OrderFulfillment 增强 | 物流异常+售后联动 | 不接真实物流 API；售后仅用计划内字段，不新增表 | ✅ |
| 6 | Supervisor 动态路由+确认 UI | 编排智能化+人审闭环 | 轻量 Python 路由；确认存 `operation_plans` 加列（不新增表） | ✅ |
| 7 | 作品化 | 可展示作品 | 全栈 Docker Compose + nginx 反代免 CORS；README/面试文档/示例数据/截图指南 | ✅ |
| 8 | 用户流程重构（两线） | 导出/收藏/销售监控 | 8.1 平台导出、8.2 收藏复用、8.3 销售监控 SVG；8.4 平台真发布留 M3 | ✅（8.4 留待 M3） |
| 9 | 线1 上架流水线（**目录优先**） | 选商品+平台走通 | **修订**：自由输入想法 → 目录优先（勾选商品+平台，从 Java 拉数据）；`ProductPlanningAgent` 加 `selected_platforms`+平台文案归一化；前端四步向导 | ✅ |
| 10 | 目录优先收尾+品类/库存底座 | 基础数据补齐 | 10.1 品类管理（Java `category/`+V7+前端品类区块+商品带品类）；10.2 库存新建表单；10.3 销售监控待办条 | ✅ |

### 8.3 线一里程碑（开发目标，按链路顺序）
| 里程碑 | 内容 | 依赖 | 状态 |
|---|---|---|---|
| **M0 收尾** | 线1 端到端验证（文案✅）+ 已知 500 已修 | 浏览器走一遍四步 | ✅ |
| **M1 图生图 / 文生图** | 出图 API 接入设置中心，真实返回主图 URL；缺 Key 前端拦截，不生成假图 | 出图 API Key | ✅（依赖用户配置 Key） |
| **M2 审核强化** | 图真生成后、发布前终审门控 | M1 | ⏳ |
| **M3 三平台发布适配器** | 抽象统一 PublishAdapter，并分别接小红书 / 淘宝 / 抖音开放平台发布 API | 各平台商家权限（AppKey+Secret+OAuth） | ⏳ |
| **M4 多平台发布复用** | 同一商品可分别按三平台生成/确认/发布，复用线一单平台流程 | M3 | ⏳ |

---

## 九、当前完成状态（截至 2026-07-12，全部完成待归档）

- ✅ 第一期（Task 1–13）：大骨架小闭环，端到端跑通。
- ✅ 第二期阶段 0–10：LLM 打底、前端只读、4 Agent 增强、动态路由+确认 UI、作品化、用户流程重构（导出/收藏/销售监控）、线1 **目录优先**改造、品类管理、库存新建表单、销售监控待办条。
- ✅ 线1 真实状态：单商品 + 单平台上架流程已成型；小红书 / 淘宝 / 抖音均可作为目标平台；ContentBrief 上架策略、图片生成、文案生成、AI 出视频、人审门控、运营计划落库已接入；发布闸门可确认计划并标记商品 PUBLISHED；真实三方平台发布 API 适配仍待 M3。
- ✅ **前端美化（现代简约浅色 SaaS · 小红书红强调色）**：`styles.css` 建立手写设计系统（token/卡片/按钮变体/表单聚焦环/柔和底纹徽标/空·加载态/带连接线步骤条/KPI 卡）；新增 `PageHeader`/`EmptyState` 组件；8 个页面统一套用；`App.tsx` 侧边栏按蓝图分组并把"新品上架"置首位、`/` 指向 NewListing。`npm run build` 通过。
- ✅ 构建/测试全绿：`uv run pytest` 39 passed；`mvn compile` 通过；`npm run build` 通过。
- ⏳ **待归档**：全部未提交改动（含阶段 8/9/10 + bug 修复）待用户确认后 `git commit`（不主动 `push`）。

---

## 十、后续路线图（方向）
1. **三平台发布适配器**：抽象统一发布接口，再分别接小红书 / 淘宝 / 抖音开放平台，做到填凭证后可发布。
2. **发布前终审**：基于已生成文案、图片、视频、库存状态做最终门禁，失败给出中文原因。
3. **多平台复用**：同一商品按平台分别生成、确认、发布，复用线一单平台流程。
4. **线二前端化**：库存/履约日常监控做成独立可交互审批页（当前 trace 在计划详情里看）。
5. **数据真实化**：`daily_sales`/库存数据源从种子切到店铺开放 API。

---

## 十一、开发规则（约束）
- **小步推进**：文档/笔记/代码/配置都小步；发现不属于本次任务的内容先说明，不回滚。
- **先说明后改**：每次改动前说明将要修改什么。
- **Git**：未经明确要求不主动 `git commit`；`git push` 由用户人工完成。
- **落库契约稳定**：扩展字段向后兼容；Java 通用 Map/json 承载 Agent JSON。
- **降级不中断**：任一外部/LLM 调用须有规则 fallback，失败记入 `errors` 且不中断主链路。
- **轻薄前端**：不引重型 UI 库、不引入登录鉴权（除非另有需要）。
- **新增表/API 五问**（任一回答"能跑通"则第一期默认不做）：
  1. 是否服务当前闭环？
  2. 哪个 Agent 读写它？
  3. 是否进入执行记录/trace 链路？
  4. 能否先用 JSON 字段或轻量状态代替？
  5. 不做它，闭环是否仍能跑通？
