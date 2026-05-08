# TrinityWar 后端开发参考文档索引 v0.1

## 一、目标

这份文档用于确认：

1. 当前后端开发必须依赖哪些设计资料。
2. 哪些资料已经足够支撑编码。
3. 哪些资料仍需补齐，否则会影响接口与表结构设计。

## 二、后端开发必须具备的参考文档

### 1. 核心经济与资产状态定义

用途：

1. 确认金库、余额、待领取收益、外场投入、阵营公库的状态边界。
2. 确认哪些资产可被掠夺，哪些不可。
3. 确认后端资产表和流水表的分层方式。

当前来源：

1. docs/design/simple-game-design.md
2. docs/design/gold-economy-and-inflation-control-plan.md
3. docs/design/gold-cost-curve-first-pass.md

状态：已具备

### 2. 外场成长与状态机规则

用途：

1. 确认外场阶段枚举。
2. 确认成长计算方式和关键落库时点。
3. 确认可收价值、被掠价值、剩余价值的关系。

当前来源：

1. docs/design/simple-game-design.md
2. docs/design/field-time-state-machine.md

状态：已具备

### 3. 异步结算、并发、锁和幂等规则

用途：

1. 确认关键请求的事务边界。
2. 确认需要版本号或幂等键的接口。
3. 确认行锁粒度和任务落库策略。

当前来源：

1. docs/design/async-settlement-and-concurrency-rules.md

状态：已具备

### 4. 阵营、排行、分红、匹配规则

用途：

1. 确认 faction、leaderboard、contribution、dividend 等模块字段。
2. 确认赛季、软重置和目标池刷新规则。

当前来源：

1. docs/design/raid-ranking-flow.md
2. docs/design/matching-and-target-pool-rules.md
3. docs/design/season-and-soft-reset-plan.md
4. docs/design/player-daily-task-rules.md

状态：已具备

### 5. 后端模块与技术边界说明

用途：

1. 确认模块拆分。
2. 确认 API、定时任务、缓存和数据库的角色。
3. 确认首发阶段不需要过度服务化。

当前来源：

1. docs/design/wechat-minigame-tech-solution.md

状态：已具备

### 6. 数据模型总览文档

用途：

1. 让后端开发不用反复从设计稿里猜表结构。
2. 让 API 设计与数据库实体使用同一套命名。
3. 让后台管理系统知道应该能看哪些对象。

当前来源：

1. docs/backend/backend-field-derivation-and-data-model.md

状态：已具备

### 7. API 契约与错误码文档

用途：

1. 给客户端和后台联调用。
2. 固化请求参数、返回结构和错误码。
3. 明确 admin API 与 client API 的权限边界。

当前来源：

1. services/game-server 的 Swagger 文档

状态：部分具备

当前缺口：

1. 还没有统一错误码规范。
2. 还没有批量覆盖首发核心业务接口。

### 8. 作业与定时任务说明

用途：

1. 明确哪些规则走实时请求，哪些规则走异步 job。
2. 明确每个 job 的输入、锁、重试和补偿。

当前来源：

1. docs/design/wechat-minigame-tech-solution.md
2. docs/design/async-settlement-and-concurrency-rules.md

状态：部分具备

当前缺口：

1. 还没有 job 级别的清单文档。

## 三、当前结论

后端文档基础已经足够进入数据建模和接口设计阶段。

真正缺的不是玩法规则，而是工程化落地文档：

1. 数据模型总览。
2. API 契约清单。
3. 错误码与幂等策略清单。
4. job 清单。

## 四、后端下一步建议补齐顺序

1. 首批核心实体与字段总览。
2. 首发 client API 列表。
3. 首发 admin API 列表。
4. 错误码与版本号规范。
5. job 与定时任务清单。
