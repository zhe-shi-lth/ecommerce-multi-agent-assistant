# 企业流程自动化多 Agent 协同平台目标计划

## 1. 项目定位

本项目是一个面向市场就业的学习型工程项目，目标不是简单做一个 Java 传统后台，也不是只写一个能调用大模型 API 的 Python Demo，而是构建一个可解释、可追踪、可落地的企业流程自动化多 Agent 协同系统。

项目核心定位：

- Python 多 Agent 协同层是主要技术亮点。
- Java 企业业务系统是 Agent 落地到真实业务场景的载体。
- 项目重点体现 Agent 任务规划、Agent 路由、工具调用、风险审核、人机协同、执行追踪和结构化输出能力。
- Java 侧重点不再是传统 CRUD 炫技，而是提供企业系统接口、状态流转、审计记录和业务数据承载能力。

暂定项目名称：企业流程自动化多 Agent 协同平台。

## 2. 就业目标

目标岗位方向：

- Java 后端工程师，具备 AI Agent 工程化能力。
- AI 应用开发工程师，具备企业系统集成经验。
- 企业自动化、智能客服、智能工单、智能审批、业务流程 Agent 等方向的应用型岗位。

项目希望在简历中体现的能力：

- 能使用 Python 设计多 Agent 协同流程，而不是只会调用单个 LLM 接口。
- 能将 Agent 能力接入 Java 企业系统，完成真实业务流程闭环。
- 能处理 Agent 输出不稳定、工具调用失败、流程风险、人机确认、执行审计等工程问题。
- 能从理论层面讲清楚多 Agent 为什么要拆分、如何协调、如何评估、如何降级。

推荐简历表达：

> 设计并实现企业流程自动化多 Agent 协同平台，以 Python 构建 Agent 编排层，支持任务规划、Agent 路由、业务分析、风险审核、工具调用和人工确认；以 Java Spring Boot 提供企业业务系统接口、流程状态管理和审计记录，实现从用户工单提交到 Agent 分析、风险判定、工具执行、人工确认和流程流转的完整闭环。

## 3. 总体架构

系统分为四层：

### 3.1 用户与业务入口层

第一阶段可以先通过 REST API 或简单管理界面发起流程。后续再增加前端页面。

职责：

- 提交工单或流程请求。
- 查看 Agent 分析结果。
- 查看流程状态。
- 执行人工确认或退回补充。
- 查看 Agent 执行链路和审计记录。

### 3.2 Java 企业业务系统层

Java 侧作为企业业务系统，不是项目主角，但负责提供真实业务上下文和可执行工具。

主要职责：

- 工单创建、查询、更新。
- 用户、角色、部门等基础数据。
- 流程状态管理。
- 人工确认节点。
- 审计日志记录。
- 暴露给 Python Agent 调用的业务 API。

推荐技术：

- Java 17 或 Java 21。
- Spring Boot 3.x。
- Spring Web。
- Spring Validation。
- Spring Security，后期加入。
- MyBatis Plus 或 Spring Data JPA，择一即可。
- PostgreSQL 或 MySQL。
- OpenAPI/Swagger。

### 3.3 Python 多 Agent 协同层

Python 是项目核心层，负责智能流程判断和 Agent 协同。

第一阶段 Agent 设计：

- Supervisor Agent：总控 Agent，负责接收任务、检查上下文、决定是否继续自动化流程。
- Planner Agent：规划 Agent，负责把用户请求拆成可执行步骤。
- Router Agent：路由 Agent，负责判断任务应该交给哪个业务 Agent 或工具。
- Ticket Analysis Agent：工单分析 Agent，负责分类、优先级、影响范围和缺失信息判断。
- Risk Review Agent：风险审核 Agent，负责判断是否可以自动流转，或必须进入人工确认。
- Executor Agent：执行 Agent，负责调用 Java 业务系统 API，执行状态变更、分派、补充记录等动作。

第一阶段不追求 Agent 数量继续扩张，重点是让这些 Agent 的职责边界清晰、输入输出稳定、调用链路可追踪。

推荐技术：

- Python 3.11+。
- FastAPI。
- Pydantic。
- LangGraph 或 AutoGen，第一阶段优先考虑 LangGraph，因为它更适合显式流程编排和状态追踪。
- HTTPX。
- pytest。
- structlog 或 loguru。

### 3.4 LLM 与工具层

LLM 不是系统本身，LLM 是 Agent 的推理能力来源。工具层负责把企业系统能力提供给 Agent 调用。

工具示例：

- 查询工单详情。
- 查询用户和部门信息。
- 查询历史相似工单。
- 更新工单状态。
- 生成处理建议。
- 标记需要人工确认。
- 写入 Agent 执行记录。

第一阶段工具以 HTTP 调用 Java API 为主。后续可以增加数据库查询工具、消息通知工具、知识库检索工具和流程引擎工具。

## 4. 第一阶段业务场景

第一阶段选择智能工单流程，作为多 Agent 协同的最小可落地场景。

核心流程：

1. 用户提交工单。
2. Java 系统保存工单，状态为待 Agent 分析。
3. Java 调用 Python Agent 服务。
4. Supervisor Agent 接收工单上下文。
5. Planner Agent 拆分分析任务。
6. Router Agent 分发给工单分析 Agent 和风险审核 Agent。
7. Ticket Analysis Agent 输出分类、优先级、缺失信息和处理建议。
8. Risk Review Agent 输出风险等级、是否允许自动流转、是否需要人工确认。
9. Supervisor Agent 汇总结构化结果。
10. Executor Agent 在允许的情况下调用 Java API 更新状态；高风险场景进入人工确认。
11. Java 系统保存 Agent 分析结果、执行记录和审计日志。

MVP 目标：

- 能提交一条工单。
- 能触发 Python 多 Agent 分析。
- 能看到每个 Agent 的输入、输出和结论。
- 能根据 Agent 结果自动进入“待补充信息”“待人工确认”“已自动分派”三类状态之一。
- 能在 Java 系统中保存完整执行链路。

第一阶段暂不做：

- 完整微服务治理。
- Kubernetes。
- 复杂前端。
- 企业微信、钉钉等外部通知。
- 完整 RAG 知识库。
- 自研流程引擎。
- 多租户 SaaS。

这些能力可以放到第二阶段或第三阶段。

## 5. 多 Agent 理论学习路线

理论学习必须服务于项目落地。每个理论主题都要能映射到项目中的一个模块或一个设计选择。

### 5.1 Agent 基础

学习目标：

- 理解 LLM、Agent、Workflow、Tool Calling 的区别。
- 理解 ReAct、Plan-and-Execute、Reflection、Supervisor 等常见模式。
- 理解为什么企业项目中不能只依赖自由对话式 Agent。

项目映射：

- Supervisor Agent 对应总控模式。
- Planner Agent 对应计划与分解模式。
- Executor Agent 对应工具调用模式。
- Risk Review Agent 对应反思与审核模式。

### 5.2 多 Agent 协同

学习目标：

- 理解多 Agent 的拆分依据：按职责拆、按领域拆、按流程阶段拆。
- 理解集中式协调和去中心化协作的区别。
- 理解 Agent 之间如何传递上下文、状态和结构化结果。

项目映射：

- 第一阶段采用集中式 Supervisor 协调。
- Agent 之间不直接随意对话，而是通过明确的数据结构和流程状态传递结果。
- 每个 Agent 只负责一个清晰职责，避免单个 Agent 变成不可维护的万能助手。

### 5.3 工具调用

学习目标：

- 理解工具是 Agent 影响真实系统的边界。
- 理解工具调用必须有参数校验、权限控制、超时、失败重试和审计记录。
- 理解只允许 Agent 调用经过封装的业务工具，不能让 Agent 直接随意操作数据库。

项目映射：

- Python Executor Agent 通过 HTTP 调用 Java API。
- Java API 负责权限、事务和审计。
- Python 侧负责选择工具、组织参数和处理调用结果。

### 5.4 结构化输出

学习目标：

- 理解企业系统不能依赖纯自然语言结果推进流程。
- 学习使用 Pydantic 或 JSON Schema 约束 Agent 输出。
- 学习输出校验失败后的重试、降级和人工确认。

项目映射：

- Ticket Analysis Agent 输出结构化分类结果。
- Risk Review Agent 输出结构化风险结果。
- Supervisor Agent 输出统一决策对象。

### 5.5 可观测性与评估

学习目标：

- 理解 Agent 系统需要追踪每一步输入、输出、耗时、错误和决策依据。
- 理解评估不仅是模型回答好不好，还包括流程是否正确、工具是否安全、结果是否可复现。

项目映射：

- Java 保存 Agent 调用记录。
- Python 保存 Agent 执行日志。
- 每次流程执行都有 trace_id。
- 后续增加测试集评估 Agent 分类准确率和风险判断稳定性。

## 6. 实践落地路线

### 阶段 0：项目准备

目标：

- 明确项目定位、技术栈、业务场景和学习路线。
- 建立文档目录和版本管理。
- 形成目标计划文档和后续实施计划。

产出：

- 目标计划文档。
- 技术选型说明。
- 阶段性任务计划。

### 阶段 1：理论学习与原型验证

目标：

- 学习 Agent 基础、多 Agent 协同、工具调用、结构化输出。
- 使用 Python 写最小多 Agent 原型。

产出：

- 一个纯 Python 的多 Agent 命令行或 API 原型。
- 能输入工单文本，输出分类、风险、建议和下一步动作。
- Agent 输出必须是结构化 JSON。

### 阶段 2：Java 业务系统最小闭环

目标：

- 建立 Java Spring Boot 工单业务系统。
- 提供 Agent 可调用的业务 API。

产出：

- 工单创建 API。
- 工单查询 API。
- 工单状态更新 API。
- Agent 执行记录保存 API。
- 审计日志表。

### 阶段 3：Python Agent 服务化

目标：

- 将 Python 原型改造成 FastAPI 服务。
- Java 可以调用 Python Agent 服务完成工单分析。

产出：

- `/agent/tickets/analyze` 接口。
- Supervisor、Planner、Router、Analysis、Risk、Executor 的初版实现。
- Pydantic 输入输出模型。
- trace_id 全链路透传。

### 阶段 4：Java 与 Python 集成闭环

目标：

- 完成从 Java 提交工单到 Python 多 Agent 分析，再回写 Java 流程状态的闭环。

产出：

- Java 调用 Python Agent 服务。
- Python Executor 调用 Java 工具 API。
- 工单状态自动流转。
- 人工确认状态。
- Agent 执行链路查询。

### 阶段 5：工程化增强

目标：

- 让项目从 Demo 接近就业作品。

产出：

- 统一异常处理。
- 超时和重试。
- 工具调用审计。
- Agent 输出校验失败处理。
- Docker Compose 一键启动。
- README 演示文档。
- 面试讲解文档。

### 阶段 6：高级增强

目标：

- 增加更有竞争力的 Agent 工程能力。

可选产出：

- 相似工单检索。
- 简单知识库 RAG。
- Agent 评估数据集。
- 流程配置化。
- 消息队列异步处理。
- 前端管理界面。
- LangSmith 或 OpenTelemetry 追踪能力，二选一即可，第一优先级是能看到每次 Agent 执行的输入、输出、耗时、错误和工具调用。

## 7. 技术边界与原则

项目开发原则：

- Python 多 Agent 是主线，Java 是企业集成载体。
- 第一阶段只做智能工单，不扩散到报销、采购、CRM 等多个流程。
- Agent 职责宁可少而清晰，不追求数量堆叠。
- Agent 输出必须结构化，不能只返回自然语言。
- 工具调用必须经过 Java API，不直接绕过业务系统。
- 高风险动作必须进入人工确认。
- 每一次 Agent 决策都要能追踪输入、输出、工具调用和最终结果。
- 先做同步 HTTP 闭环，后续再引入消息队列。
- 先做后端和 API，前端可以后置。

## 8. 推荐仓库结构

后续实施时建议采用单仓库多模块结构：

```text
enterprise-process-multi-agent/
  docs/
    superpowers/
      specs/
      plans/
    learning/
    interview/
  java-service/
    src/
    pom.xml
  python-agent-service/
    app/
    tests/
    pyproject.toml
  docker-compose.yml
  README.md
```

当前仓库先从 `docs/` 开始，等目标计划和实施计划确认后，再创建 `java-service/` 和 `python-agent-service/`。

## 9. 面试讲解路径

面试时建议按下面顺序讲：

1. 先讲业务问题：企业流程中存在大量重复判断、信息补全、风险审核和人工分派。
2. 再讲架构选择：Java 负责稳定业务系统，Python 负责多 Agent 智能协同。
3. 再讲多 Agent 分工：Supervisor、Planner、Router、Analysis、Risk、Executor。
4. 再讲工程难点：结构化输出、工具调用边界、失败重试、人工确认、审计追踪。
5. 再讲落地效果：工单从提交到分析、审核、分派、人工确认形成闭环。
6. 最后讲可扩展方向：RAG、消息队列、评估体系、流程配置化、可观测性。

重点表达：

> 这个项目不是把大模型接到 Java 后台里，而是把 Python 多 Agent 作为企业流程自动化的智能协调层。Java 提供业务事实、权限和执行能力，Python Agent 负责理解任务、规划步骤、路由子任务、审核风险和调用工具。所有 Agent 结论都会结构化落库，关键动作支持人工确认和审计追踪。

## 10. 第一轮学习清单

第一轮理论学习不追求广，先学能支撑 MVP 的内容。

学习顺序：

1. LLM 与 Agent 基础概念。
2. Tool Calling 与结构化输出。
3. ReAct、Plan-and-Execute、Supervisor 模式。
4. LangGraph 基础。
5. FastAPI + Pydantic 服务化。
6. Spring Boot 提供企业业务 API。
7. Java 调用 Python 服务，Python 调用 Java 工具 API。
8. Agent 执行链路记录与审计。

每个主题的学习结果都要沉淀到 `docs/learning/`，并尽量配一个可运行小例子。

## 11. 下一步

下一步不直接写业务代码，而是先创建实施计划。实施计划会把阶段 1 拆成更小任务：

- 建立 Python Agent 服务目录。
- 定义工单分析输入输出模型。
- 编写第一个 Agent 单元测试。
- 实现纯规则版本的多 Agent 协同骨架。
- 再接入 LLM。
- 最后把原型服务化。

这样可以保证理论学习和实践落地同步推进，不会只停留在概念，也不会一开始就陷入复杂工程细节。
