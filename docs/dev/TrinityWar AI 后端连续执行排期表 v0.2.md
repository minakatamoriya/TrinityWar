# TrinityWar AI 后端连续执行排期表 v0.2

## 一、文档目的

这份文档不是普通项目计划，而是给 AI 连续执行后端改造任务使用的执行排期表。

目标是把当前后端改造拆成一串可以逐个执行、逐个验证、逐个验收的小任务。后续执行时，可以直接把某一个任务编号、对应任务内容和本文的统一执行规则一起发给 AI，让 AI 按顺序推进。

每一项任务都必须具备六类信息：

1. 明确目标。
2. 明确前置文档。
3. 明确建议操作范围。
4. 明确产出要求。
5. 明确最小验证建议。
6. 明确人工验收清单。

## 二、使用方式

推荐严格按任务编号顺序执行。不要同时让 AI 并行修改 3 到 4 个大切片。

推荐节奏：

1. 一次只让 AI 完成一个任务编号。
2. AI 完成后必须说明修改内容、验证结果、满足项和未满足项。
3. 人类按任务的验收清单核对。
4. 验收通过后，再把该项状态改成已完成。
5. 再继续下一项。

不建议跳步的原因：

1. 当前目标不是多写几个接口，而是把数据库、事务、幂等、异步、日志和前后端联调顺序一起收住。
2. 如果跳步，AI 容易先写出表面可跑代码，后续在 schema、事务边界、幂等语义和 mock 退场时大面积返工。

## 三、状态标记规则

任务标题统一使用以下状态：

1. `[ ]` 未开始。
2. `[~]` AI 已实现，等待人工验收。
3. `[-]` 阻塞，必须先处理阻塞原因。
4. `[x]` 人工验收通过。

AI 默认不得直接把任务改成 `[x]`。AI 完成实现和自测后，可以把任务改成 `[~]`，并在 [docs/任务开发日志.md](../任务开发日志.md) 追加执行记录。只有人类验收通过后，才把状态改成 `[x]`。

如果发现前置文档缺失、前置任务未完成、数据结构不支持、关键契约不清晰，AI 应停止硬写，把任务标成 `[-]` 或在输出中明确列出阻塞点。

## 四、总工期判断

按“AI 连续执行 + 人类每日验收与纠偏”估算：

1. 最快可用版：15 到 20 个工作日。
2. 更稳的首版：20 到 30 个工作日。

这里的“工作日”不是人类全职开发日，而是按 AI 每天持续执行多个任务切片、人类进行一次或多次验收来估算。

如果规则口径、接口契约、数据库结构频繁变化，工期要再加 30% 到 50%。

## 五、统一执行规则

所有任务都默认遵守以下规则。

### 1. 一次只做一个任务编号

不要把两个阶段合并成一轮大改动。当前任务没有明确要求的内容，只能作为发现项记录，不能顺手实现。

### 2. 先读文档，再读代码，再写代码

至少要读取：

1. 本任务列出的前置文档。
2. 当前任务涉及的代码入口。
3. 与本任务相关的已有测试、脚本和共享类型。

AI 输出时必须说明读过哪些关键文档和代码入口。

### 3. 不允许静默扩大范围

如果当前任务是读接口切换，就不要顺手重写命令接口。如果当前任务是 migration，就不要顺手实现业务 controller。

允许做的额外修改只有三类：

1. 当前任务无法编译所需的极小修复。
2. 当前任务产出必须依赖的脚本或配置补齐。
3. 当前任务验收所需的最小测试或验证入口。

### 4. 每轮必须有最小验证

验证优先级：

1. 相关自动化测试。
2. 相关模块编译、类型检查或 lint。
3. migration、seed、接口请求、worker 启动等最小可运行验证。

如果因为本地环境缺少数据库、Redis、依赖或密钥而无法验证，AI 必须明确写出“未验证项”和“阻塞原因”，不能把未运行的验证说成已通过。

### 5. 日志与状态更新分离

AI 完成实现后，应追加 [docs/任务开发日志.md](../任务开发日志.md) 记录，并把当前任务状态改为 `[~]`。人工验收通过后，再把任务状态改为 `[x]`。

如果任务阻塞，优先在输出中列出阻塞点。只有阻塞会长期影响排期时，才把任务状态改为 `[-]`。

### 6. 输出必须可验收

AI 每轮最终输出必须包含：

1. 本轮修改了什么。
2. 修改了哪些文件。
3. 执行了哪些验证命令或手动验证。
4. 哪些验收项已满足。
5. 哪些验收项未满足。
6. 是否存在越界修改、阻塞或后续风险。

## 六、推荐给 AI 的固定开场提示词

每次执行某个任务时，建议把下面模板和任务内容一起发给 AI。

```text
你现在只执行 TrinityWar 后端排期中的一个任务，不要扩大范围。

任务编号：<填写任务编号>
任务名称：<填写任务名称>

执行要求：
1. 先阅读该任务列出的前置文档、当前代码入口、相关测试和脚本。
2. 只在当前任务的“建议 AI 操作范围”内修改代码；如确需越界，先说明原因。
3. 完成后执行该任务列出的“最小验证建议”；无法执行的验证必须说明阻塞原因。
4. AI 完成后只能把任务状态改为 [~]，不能直接改成 [x]。
5. 输出时必须包含：
   - 本轮修改了什么
   - 修改了哪些文件
   - 验证做了什么
   - 哪些验收项已经满足
   - 哪些验收项未满足
   - 是否存在阻塞或风险
6. 如果发现前置条件未完成，不要硬写，直接指出阻塞点。
```

## 七、阶段总览

| 阶段 | 目标 | 预计工期 |
| --- | --- | --- |
| P0 | 锁定基线与新后端骨架 | 1 到 2 天 |
| P1 | Prisma 与数据库基础落地 | 2 到 4 天 |
| P2 | 身份、建档、测试账号闭环 | 1 到 2 天 |
| P3 | 首批真实读接口接库 | 3 到 5 天 |
| P4 | 审计、幂等、核心写链路 | 4 到 7 天 |
| P5 | 掠夺异步结算与战报 | 3 到 5 天 |
| P6 | 前端 mock 退场与真实联调 | 2 到 4 天 |
| P6.5 | 灵宠体系建设插入项 | 6 到 11 天 |
| P6.6 | 菜田留言板与战报附言延后项 | 2 到 4 天 |
| P7 | 后台只读排查能力与收尾稳定 | 2 到 4 天 |

## 八、逐项执行排期

---

## P0 基线与骨架

### [x] TW-BE-001 建立正式后端应用骨架

预计工期：1 天

目标：

1. 在现有仓库内建立正式后端主工程基础结构。
2. 引入 NestJS、Prisma、Redis、BullMQ、Swagger、Pino 所需基础依赖和目录骨架。
3. 不写业务逻辑，但要求能启动应用与基础健康检查。

前置文档：

1. [docs/dev/TrinityWar AI 后端总计划 v0.1.md](TrinityWar AI 后端总计划 v0.1.md)
2. [docs/dev/TrinityWar 首批 NestJS 模块拆分与目录骨架规划 v0.1.md](TrinityWar 首批 NestJS 模块拆分与目录骨架规划 v0.1.md)
3. [docs/dev/TrinityWar 后端 Service 分层设计 v0.1.md](TrinityWar 后端 Service 分层设计 v0.1.md)

建议 AI 操作范围：

1. `services/game-server`
2. 根目录 `package.json`、workspace 配置和必要脚本。
3. 后端启动、构建、基础环境配置文件。

产出要求：

1. 正式后端目录结构清晰。
2. API 应用可以本地启动。
3. 有健康检查接口。
4. 有 Swagger 初始化。
5. 不引入业务状态和业务规则堆砌。

最小验证建议：

1. 执行后端安装或 workspace 依赖检查。
2. 执行后端类型检查或构建脚本。
3. 启动 API，并访问健康检查与 Swagger JSON 或页面。

验收清单：

1. [ ] 依赖安装和脚本结构已就位。
2. [ ] 应用可以启动。
3. [ ] 健康检查接口可访问。
4. [ ] Swagger 页面或 JSON 可访问。
5. [ ] 未开始写业务逻辑堆砌代码。

### [x] TW-BE-002 建立共享基础设施模块

预计工期：0.5 到 1 天

目标：

1. 建立 config、logging、prisma、auth 占位、error handling 等共享基础模块。
2. 为后续业务模块提供统一注入点。
3. 明确全局异常、日志、配置读取的基础形态。

前置文档：

1. [docs/dev/TrinityWar 首批 NestJS 模块拆分与目录骨架规划 v0.1.md](TrinityWar 首批 NestJS 模块拆分与目录骨架规划 v0.1.md)
2. [docs/dev/TrinityWar 后端 Service 分层设计 v0.1.md](TrinityWar 后端 Service 分层设计 v0.1.md)

建议 AI 操作范围：

1. `services/game-server/src/common`
2. `services/game-server/src/config`
3. `services/game-server/src/prisma`
4. `services/game-server/src/auth`
5. 后端应用入口和模块注册文件。

产出要求：

1. `PrismaService` 或等价数据库服务可注入。
2. 全局异常响应结构有统一出口。
3. 日志模块和配置模块可被业务模块复用。
4. auth 只做占位和最小上下文，不提前实现复杂登录。

最小验证建议：

1. 执行后端类型检查或构建。
2. 启动应用确认全局模块注册不报错。
3. 访问健康检查确认异常过滤器、日志初始化不破坏启动。

验收清单：

1. [ ] PrismaService 已可注入。
2. [ ] 全局异常结构有统一出口。
3. [ ] 日志模块可用。
4. [ ] 配置读取不再散落在业务文件中。

---

## P1 数据库与迁移基础

### [x] TW-BE-003 落地 Migration 001 与 002

预计工期：1 天

目标：

1. 落地 Player、PlayerAuthIdentity、Faction、FactionMember。
2. 跑通 Prisma schema、client generation 和 migration。
3. 建立玩家身份与阵营关系的最小数据库基础。

前置文档：

1. [docs/dev/TrinityWar 首批数据库表与 Prisma Schema 草案 v0.1.md](TrinityWar 首批数据库表与 Prisma Schema 草案 v0.1.md)
2. [docs/dev/TrinityWar 首批数据库 Migration 切分计划 v0.1.md](TrinityWar 首批数据库 Migration 切分计划 v0.1.md)

建议 AI 操作范围：

1. `services/game-server/prisma/schema.prisma`
2. `services/game-server/prisma/migrations`
3. Prisma 生成、迁移相关脚本。
4. 必要的数据库配置样例。

产出要求：

1. Migration 001 与 002 边界符合拆分计划。
2. 玩家、身份、阵营、成员关系结构可迁移。
3. 唯一约束、外键关系、索引与文档一致。
4. 不提前塞入 wallet、building、field、task 等后续主状态表。

最小验证建议：

1. 执行 `prisma generate`。
2. 在开发数据库执行 migration。
3. 如项目已有 schema 校验或 migration 测试，必须执行相关测试。

验收清单：

1. [ ] schema.prisma 可生成 client。
2. [ ] migration 可执行。
3. [ ] 唯一约束与索引符合文档要求。
4. [ ] 没有把后续主状态表一次性塞进同一批迁移。

### [x] TW-BE-004 落地 Migration 003 与 004

预计工期：1 到 2 天

目标：

1. 落地 PlayerWallet、PlayerBuilding、PlayerArmy、ArmyTrainingQueue。
2. 落地 Field、Seed、Task 相关第一批当前状态表。
3. 把首页与场景读接口需要的主状态表准备好。

前置文档：

1. [docs/dev/TrinityWar 首批数据库表与 Prisma Schema 草案 v0.1.md](TrinityWar 首批数据库表与 Prisma Schema 草案 v0.1.md)
2. [docs/dev/TrinityWar 首批数据库 Migration 切分计划 v0.1.md](TrinityWar 首批数据库 Migration 切分计划 v0.1.md)

建议 AI 操作范围：

1. `services/game-server/prisma/schema.prisma`
2. `services/game-server/prisma/migrations`
3. 与新增表相关的最小 Prisma 类型使用处。

产出要求：

1. 当前状态表支持 bootstrap、home-summary、scene-content 的主读取。
2. 高频读字段具备必要索引。
3. 关键状态表具备版本字段或等价并发控制字段。
4. 不实现读接口和命令业务逻辑。

最小验证建议：

1. 执行 `prisma generate`。
2. 执行新增 migration。
3. 如支持测试数据库，验证 migration 从空库可完整跑通。

验收清单：

1. [ ] 当前状态表已齐备。
2. [ ] 关键版本字段已落地。
3. [ ] 高频读字段索引已落地。
4. [ ] 数据库结构足以支撑 bootstrap、home-summary、scene-content 的主读取。

### [x] TW-BE-005 落地种子数据与测试账号初始化

预计工期：0.5 到 1 天

目标：

1. 建立 faction、static seed data、测试账号初始化机制。
2. 让开发环境具备可重复重建的最小联调数据。
3. 为后续登录、读接口和联调提供稳定初始状态。

前置文档：

1. [docs/dev/TrinityWar Prisma Seed 与初始静态数据装载计划 v0.1.md](TrinityWar Prisma Seed 与初始静态数据装载计划 v0.1.md)
2. [docs/dev/TrinityWar 后端初始建档与首批测试账号方案 v0.1.md](TrinityWar 后端初始建档与首批测试账号方案 v0.1.md)

建议 AI 操作范围：

1. `services/game-server/prisma/seed.*`
2. `services/game-server/src/seed` 或等价初始化模块。
3. package 脚本中的 seed 命令。
4. 必要的开发测试账号配置样例。

产出要求：

1. seed 可重复执行。
2. 至少一组开发测试账号可用。
3. 新玩家初始化逻辑集中，不散落在多个脚本中。
4. 静态数据与玩家初始状态职责分离。

最小验证建议：

1. 执行 seed 命令。
2. 重复执行 seed，确认不会产生重复静态数据。
3. 查询或测试确认测试账号与初始状态存在。

验收清单：

1. [ ] seed 命令可执行。
2. [ ] 至少一组开发测试账号可用。
3. [ ] 新玩家初始化状态可重复生成。
4. [ ] 静态表与玩家初始状态没有手工散改。

---

## P2 身份与建档闭环

### [x] TW-BE-006 实现登录、建档、当前玩家接口

预计工期：1 到 2 天

目标：

1. 实现开发环境假登录或微信登录最小闭环。
2. 实现建档逻辑。
3. 实现当前玩家基础信息读取接口。

前置文档：

1. [docs/dev/TrinityWar 首批真实接口契约清单 v0.1.md](TrinityWar 首批真实接口契约清单 v0.1.md)
2. [docs/dev/TrinityWar 首批数据库 Migration 切分计划 v0.1.md](TrinityWar 首批数据库 Migration 切分计划 v0.1.md)
3. [docs/dev/TrinityWar 首批 NestJS 模块拆分与目录骨架规划 v0.1.md](TrinityWar 首批 NestJS 模块拆分与目录骨架规划 v0.1.md)

建议 AI 操作范围：

1. `services/game-server/src/auth`
2. `services/game-server/src/player`
3. 建档初始化 service。
4. 当前玩家上下文、guard、decorator 的最小实现。

产出要求：

1. 开发登录或微信登录最小链路可用。
2. 首次登录能创建玩家档案和基础状态。
3. 再次登录不会重复建档。
4. 有 `GET /me` 或等价当前玩家接口。

最小验证建议：

1. 执行相关单元或集成测试。
2. 通过接口请求完成登录。
3. 连续登录同一账号，确认不会重复建档。
4. 请求 `GET /me`，确认返回当前玩家最小信息。

验收清单：

1. [ ] 存在可重复使用的开发登录方式。
2. [ ] 新玩家首次登录能建档。
3. [ ] 已有玩家再次登录不会重复建档。
4. [ ] token 或等价会话机制可用。
5. [ ] GET /me 等价接口可返回当前玩家最小信息。

---

## P3 首批真实读接口

### [x] TW-BE-007 接通 bootstrap 真实读接口

预计工期：0.5 到 1 天

目标：

1. 从数据库而不是内存态返回 bootstrap。
2. 保持响应契约兼容当前前端。
3. 为后续 home-summary 和 scene-content 真实读取建立模式。

前置文档：

1. [docs/dev/TrinityWar 首批读接口联调切换计划 v0.1.md](TrinityWar 首批读接口联调切换计划 v0.1.md)
2. [docs/dev/TrinityWar 首批真实接口契约清单 v0.1.md](TrinityWar 首批真实接口契约清单 v0.1.md)

建议 AI 操作范围：

1. bootstrap controller、query service、assembler。
2. 共享 API contract 或 DTO。
3. 与 bootstrap 相关的最小测试。

产出要求：

1. bootstrap 数据来自真实数据库。
2. 响应字段兼容当前前端契约。
3. controller 不直接堆 query 聚合细节。
4. 不处理 home-summary 和 scene-content 的完整切换。

最小验证建议：

1. 执行 bootstrap 相关测试。
2. 使用测试账号请求 bootstrap 接口。
3. 对照共享契约或前端字段需求检查响应结构。

验收清单：

1. [ ] bootstrap 从真实库读取。
2. [ ] 响应字段与共享契约兼容。
3. [ ] 至少有一个最小读接口验证。

### [x] TW-BE-008 接通 home-summary 真实读接口

预计工期：1 天

目标：

1. 聚合 wallet、building、task 等核心状态。
2. 首页资源条和摘要信息从真实库返回。
3. 保持前端现有 home-summary 消费方式稳定。

前置文档：

1. [docs/dev/TrinityWar 首批读接口联调切换计划 v0.1.md](TrinityWar 首批读接口联调切换计划 v0.1.md)
2. [docs/dev/TrinityWar 后端 Service 分层设计 v0.1.md](TrinityWar 后端 Service 分层设计 v0.1.md)

建议 AI 操作范围：

1. home-summary controller、query service、assembler。
2. wallet、building、task 的只读 repository 或 query 方法。
3. home-summary 相关 DTO 与测试。

产出要求：

1. home-summary 不再依赖内存主状态。
2. 聚合逻辑在 assembler 或 query service 中。
3. 首页关键字段稳定返回。
4. 不提前实现写命令。

最小验证建议：

1. 执行 home-summary 相关测试。
2. 使用测试账号请求 home-summary。
3. 确认 wallet、building、task 等字段来自数据库。

验收清单：

1. [ ] home-summary 不再依赖内存主状态。
2. [ ] 聚合逻辑在 assembler 或 query service 中，而不是 controller 中。
3. [ ] 首页关键字段可稳定返回。

### [~] TW-BE-009 接通 scene-content 真实读接口

预计工期：1 到 2 天

目标：

1. 把建筑、农场、部队、阵营等场景聚合读模型接到真实库。
2. 先保持大聚合接口，不急着拆碎。
3. 覆盖当前前端主要场景展示字段。

前置文档：

1. [docs/dev/TrinityWar 首批读接口联调切换计划 v0.1.md](TrinityWar 首批读接口联调切换计划 v0.1.md)
2. [docs/dev/TrinityWar 后端 Service 分层设计 v0.1.md](TrinityWar 后端 Service 分层设计 v0.1.md)
3. [docs/dev/TrinityWar Battle Report 与 Raid Page 前端联调字段清单 v0.1.md](TrinityWar Battle Report 与 Raid Page 前端联调字段清单 v0.1.md)

建议 AI 操作范围：

1. scene-content controller、query service、assembler。
2. building、field、army、faction 的只读查询。
3. scene-content 相关 DTO 与测试。

产出要求：

1. scene-content 主要 section 来自真实数据库。
2. 查询聚合有明确 service 或 assembler 边界。
3. 当前前端主要展示字段不缺失。
4. 不拆成多个新接口，除非前置文档已有明确要求。

最小验证建议：

1. 执行 scene-content 相关测试。
2. 使用测试账号请求 scene-content。
3. 对照字段 checklist 检查主要展示字段。

验收清单：

1. [ ] scene-content 主要 section 已来自真实库。
2. [ ] 没有把 query 聚合直接写死在单个 repository。
3. [ ] 场景页读取所需字段覆盖当前前端主要展示。

### [~] TW-BE-010 前端读链路进入“来源可见”状态

预计工期：0.5 到 1 天

目标：

1. 让前端能清楚看到 bootstrap、home、scene 各自来自 api 还是 mock。
2. 为后续 mock 退场做准备。
3. 保留必要 fallback，但让半真半假的状态可观测。

前置文档：

1. [docs/dev/TrinityWar 首批读接口联调切换计划 v0.1.md](TrinityWar 首批读接口联调切换计划 v0.1.md)
2. [docs/dev/TrinityWar 前端 Mock 数据退场计划 v0.1.md](TrinityWar 前端 Mock 数据退场计划 v0.1.md)

建议 AI 操作范围：

1. 前端 API client、data source 标记、开发调试状态展示。
2. 与 bootstrap、home-summary、scene-content 相关的 mock fallback 调用点。
3. 相关文档或调试说明。

产出要求：

1. 三个读接口的数据来源可见。
2. mock fallback 触发路径可区分。
3. 不强行删除仍需保留的 fallback。
4. 不改写后端读接口业务逻辑。

最小验证建议：

1. 启动前端开发环境。
2. 分别验证 api 成功与 fallback 场景下的来源标记。
3. 执行前端类型检查或相关测试。

验收清单：

1. [ ] 三个读接口来源可见。
2. [ ] 开发时可明确区分半真半假的状态。
3. [ ] 正式主链路还未强行移除 fallback，但来源已经透明。

---

## P4 审计、幂等、核心写链路

### [~] TW-BE-011 落地 Migration 005 与幂等支撑结构

预计工期：1 天

目标：

1. 建立核心审计日志表。
2. 建立 idempotency 记录结构。
3. 为命令链路正式接库做准备。

前置文档：

1. [docs/dev/TrinityWar 首批写链路事务与幂等策略清单 v0.1.md](TrinityWar 首批写链路事务与幂等策略清单 v0.1.md)
2. [docs/dev/TrinityWar 首批数据库 Migration 切分计划 v0.1.md](TrinityWar 首批数据库 Migration 切分计划 v0.1.md)

建议 AI 操作范围：

1. `services/game-server/prisma/schema.prisma`
2. `services/game-server/prisma/migrations`
3. 幂等记录与审计日志的基础 repository 或 service 占位。

产出要求：

1. 审计日志表结构落地。
2. idempotency 记录结构落地。
3. 能支撑后续命令在同一事务内写状态、写日志、写幂等结果。
4. 不提前实现具体业务命令。

最小验证建议：

1. 执行 `prisma generate`。
2. 执行 migration。
3. 如有 repository 占位，执行类型检查或最小测试。

验收清单：

1. [ ] 审计日志表已落地。
2. [ ] idempotency_record 或等价结构已落地。
3. [ ] 没有等到所有业务写完才补日志表。

### [~] TW-BE-012 接通升级建筑命令链路

预计工期：1 到 2 天

目标：

1. 正式实现 upgrade-building 命令。
2. 使用事务、版本校验、幂等、日志同事务。
3. 返回刷新后的 home 和 scene 数据，保持联调效率。

前置文档：

1. [docs/dev/TrinityWar 首批写链路事务与幂等策略清单 v0.1.md](TrinityWar 首批写链路事务与幂等策略清单 v0.1.md)
2. [docs/dev/TrinityWar 首批真实接口契约清单 v0.1.md](TrinityWar 首批真实接口契约清单 v0.1.md)
3. [docs/dev/TrinityWar 后端 Service 分层设计 v0.1.md](TrinityWar 后端 Service 分层设计 v0.1.md)

建议 AI 操作范围：

1. command controller、command service、规则 service。
2. building repository、wallet repository、audit/idempotency service。
3. home-summary 和 scene-content 刷新复用入口。
4. upgrade-building 相关 DTO 与测试。

产出要求：

1. controller 不包含规则和事务细节。
2. 事务内完成扣费、升级状态、日志、幂等记录。
3. 版本冲突有明确错误。
4. 幂等重试返回一致结果，不重复扣钱。

最小验证建议：

1. 执行 upgrade-building 相关单元或集成测试。
2. 手动请求一次成功升级。
3. 使用相同 idempotency key 重试，确认不重复扣钱。
4. 使用过期版本请求，确认返回版本冲突。

验收清单：

1. [ ] Controller 不包含规则和事务细节。
2. [ ] 事务内完成状态写入与日志写入。
3. [ ] 版本冲突能正确报错。
4. [ ] 幂等重试不会重复扣钱。

### [~] TW-BE-013 接通农场收取与相关命令链路

预计工期：1 到 2 天

目标：

1. 接通 collect-field。
2. 视当前切分情况补齐 seed、播种或待领取收益等紧邻命令。
3. 保证字段状态、收益计算、版本校验和日志落地一致。

前置文档：

1. [docs/dev/TrinityWar 首批写链路事务与幂等策略清单 v0.1.md](TrinityWar 首批写链路事务与幂等策略清单 v0.1.md)
2. [docs/dev/TrinityWar 首批真实接口契约清单 v0.1.md](TrinityWar 首批真实接口契约清单 v0.1.md)

建议 AI 操作范围：

1. field command controller 和 service。
2. field rule service、wallet service、audit/idempotency service。
3. field 相关 DTO、测试和最小刷新响应。

产出要求：

1. 农场状态推进以后端数据库为准。
2. 收取收益具备版本校验和幂等保护。
3. 收益计算集中在规则层。
4. 如果补齐紧邻命令，必须保持在农场状态闭环内，不能扩展到任务、训练、raid。

最小验证建议：

1. 执行 field command 相关测试。
2. 手动请求 collect-field 成功路径。
3. 重复 idempotency key，确认不会重复结算。
4. 过期 fieldVersion 请求，确认返回冲突。

验收清单：

1. [ ] 农场状态推进以后端为准。
2. [ ] 收取不会重复结算。
3. [ ] fieldVersion 或等价版本校验生效。
4. [ ] 响应刷新后的 home 和 scene 正确。

### [x] TW-BE-014 接通任务奖励、待领取收益、训练队列命令链路

预计工期：1 到 2 天

目标：

1. 接通 claim pending、claim task reward、recruit army 等高频命令。
2. 收口首页最主要的写操作。
3. 让首页主循环从真实后端完成主要状态推进。

前置文档：

1. [docs/dev/TrinityWar 首批写链路事务与幂等策略清单 v0.1.md](TrinityWar 首批写链路事务与幂等策略清单 v0.1.md)
2. [docs/dev/TrinityWar 首批真实接口契约清单 v0.1.md](TrinityWar 首批真实接口契约清单 v0.1.md)

建议 AI 操作范围：

1. task、pending reward、army training 相关 command service。
2. wallet、task、army repository。
3. audit/idempotency service 复用。
4. 相关 DTO 与测试。

产出要求：

1. 高频命令均支持幂等。
2. 关键状态变化均有日志落点。
3. 规则逻辑不写在 controller。
4. 不接入 raid 异步链路。

最小验证建议：

1. 执行相关 command 测试。
2. 分别验证 claim pending、claim task reward、recruit army 成功路径。
3. 对至少一个高价值命令验证幂等重试。
4. 验证刷新后的 home-summary 反映状态变化。

验收清单：

1. [x] 高价值命令接口均支持幂等。
2. [x] 关键状态均有日志落点。
3. [x] 首页主循环的高频写操作已基本接库。

---

## P5 掠夺与异步结算

### [~] TW-BE-015 落地 Migration 006

预计工期：0.5 到 1 天

目标：

1. 建立 raid target、raid order、raid settlement、battle report 等结构。
2. 为异步结算打基础。
3. 明确订单、结算、战报、钱包影响之间的数据边界。

前置文档：

1. [docs/dev/TrinityWar 首批数据库 Migration 切分计划 v0.1.md](TrinityWar 首批数据库 Migration 切分计划 v0.1.md)
2. [docs/dev/TrinityWar 首批数据库表与 Prisma Schema 草案 v0.1.md](TrinityWar 首批数据库表与 Prisma Schema 草案 v0.1.md)
3. [docs/dev/TrinityWar 掠夺订单与异步结算专项设计 v0.1.md](TrinityWar 掠夺订单与异步结算专项设计 v0.1.md)

建议 AI 操作范围：

1. `services/game-server/prisma/schema.prisma`
2. `services/game-server/prisma/migrations`
3. raid 相关基础 repository 占位。

产出要求：

1. raid 相关主表落地。
2. battle report 结构落地。
3. 支持异步订单生命周期。
4. 不把结算逻辑做成内存态或同步结果写死。

最小验证建议：

1. 执行 `prisma generate`。
2. 执行 migration。
3. 如有 repository 占位，执行类型检查或最小测试。

验收清单：

1. [x] raid 相关主表已落地。
2. [x] battle report 结构已落地。
3. [x] 没把异步逻辑直接做成纯内存态。

### [~] TW-BE-016 接通 raid 目标详情与发起掠夺命令

预计工期：1 到 2 天

目标：

1. 接通 raid-target detail 真实读取。
2. 接通发起掠夺命令。
3. 订单进入异步处理链路，而不是同步写死结果。

前置文档：

1. [docs/dev/TrinityWar 首批真实接口契约清单 v0.1.md](TrinityWar 首批真实接口契约清单 v0.1.md)
2. [docs/dev/TrinityWar 掠夺订单与异步结算专项设计 v0.1.md](TrinityWar 掠夺订单与异步结算专项设计 v0.1.md)
3. [docs/dev/TrinityWar 首批写链路事务与幂等策略清单 v0.1.md](TrinityWar 首批写链路事务与幂等策略清单 v0.1.md)

建议 AI 操作范围：

1. raid target query service。
2. raid order command service。
3. BullMQ enqueue 或等价异步投递入口。
4. raid order 相关 DTO、测试。

产出要求：

1. raid target detail 从数据库读取。
2. 发起掠夺后生成正式订单。
3. 幂等重试不会重复创建订单。
4. controller 不同步计算完整结算结果。

最小验证建议：

1. 执行 raid target 和 raid order 相关测试。
2. 手动请求 raid target detail。
3. 手动发起 raid order，确认订单入库。
4. 使用相同 idempotency key 重试，确认不重复创建订单。

验收清单：

1. [x] 发起掠夺后生成正式订单。
2. [x] 幂等重试不会重复创建订单。
3. [x] raid 不是 controller 内直接一把算完。

### [~] TW-BE-017 接通 BullMQ worker 与 raid settlement

预计工期：1 到 2 天

目标：

1. 建立 worker。
2. 处理 raid settlement。
3. 写入 raid settlement、battle report、钱包影响和相关日志。

前置文档：

1. [docs/dev/TrinityWar 掠夺订单与异步结算专项设计 v0.1.md](TrinityWar 掠夺订单与异步结算专项设计 v0.1.md)
2. [docs/dev/TrinityWar 后端 Service 分层设计 v0.1.md](TrinityWar 后端 Service 分层设计 v0.1.md)
3. [docs/dev/TrinityWar 首批写链路事务与幂等策略清单 v0.1.md](TrinityWar 首批写链路事务与幂等策略清单 v0.1.md)

建议 AI 操作范围：

1. worker 启动入口和 BullMQ processor。
2. raid settlement service。
3. battle report service。
4. wallet、audit、idempotency 复用入口。
5. worker 相关脚本与测试。

产出要求：

1. worker 可独立运行。
2. raid settlement 复用主规则层。
3. 结算结果、战报、钱包影响和日志一致落地。
4. 重试不会重复结算。

最小验证建议：

1. 执行 worker 或 settlement 相关测试。
2. 启动 worker。
3. 投递一笔 raid order，确认订单完成结算。
4. 查询 battle report 和 settlement 结果。

验收清单：

1. [x] worker 可独立运行。
2. [x] raid settlement 不是复制另一套规则，而是复用主规则层。
3. [x] 战报与结算结果可查询。

---

## P6 前端 mock 退场与真实联调

### [~] TW-BE-018 让 bootstrap 与 home-summary 默认走真实链路

预计工期：0.5 到 1 天

目标：

1. 在开发环境中让 bootstrap 和 home-summary 优先真实。
2. fallback 从默认兜底逐步收口。
3. 让首页进入真实后端优先的联调状态。

前置文档：

1. [docs/dev/TrinityWar 首批读接口联调切换计划 v0.1.md](TrinityWar 首批读接口联调切换计划 v0.1.md)
2. [docs/dev/TrinityWar 前端 Mock 数据退场计划 v0.1.md](TrinityWar 前端 Mock 数据退场计划 v0.1.md)

建议 AI 操作范围：

1. 前端 bootstrap 和 home-summary API client。
2. mock fallback 策略和显式开关。
3. 开发环境配置与相关测试。

产出要求：

1. bootstrap 默认走真实 API。
2. home-summary 默认走真实 API。
3. mock 只在显式失败策略或显式开关下参与。
4. 不删除仍被其他未接库页面依赖的 mock。

最小验证建议：

1. 启动前端和后端开发环境。
2. 验证 bootstrap 与 home-summary 正常请求真实 API。
3. 关闭或破坏 API 时，验证 fallback 行为符合显式策略。
4. 执行前端类型检查或相关测试。

验收清单：

1. [ ] bootstrap 默认走真实。
2. [ ] home-summary 默认走真实。
3. [ ] mock 只在显式失败策略或显式开关下参与。

### [~] TW-BE-019 让 scene-content 与核心命令退出默认 mock 主链路

预计工期：1 到 2 天

目标：

1. 让主要 scene 读取默认走真实库。
2. 让前端本地命令处理器退出默认路径。
3. 明确保留哪些调试 mock，哪些必须彻底收口。

前置文档：

1. [docs/dev/TrinityWar 前端 Mock 数据退场计划 v0.1.md](TrinityWar 前端 Mock 数据退场计划 v0.1.md)
2. [docs/dev/TrinityWar 首批读接口联调切换计划 v0.1.md](TrinityWar 首批读接口联调切换计划 v0.1.md)

建议 AI 操作范围：

1. 前端 scene-content API client。
2. 前端 command dispatch 链路。
3. 本地生命周期模拟器和 mock handler 的默认开关。
4. 调试 mock 保留清单。

产出要求：

1. scene-content 默认走真实后端。
2. 核心命令默认发往后端命令接口。
3. 本地命令处理器不再主导默认结果。
4. 保留的 mock 必须通过显式调试模式启用。

最小验证建议：

1. 启动前端和后端开发环境。
2. 验证 scene-content 请求真实 API。
3. 触发至少一个核心命令，确认走后端。
4. 执行前端类型检查或相关测试。

验收清单：

1. [ ] 本地命令处理器不再主导默认结果。
2. [ ] 本地生命周期模拟器不再与真实后端竞争。
3. [ ] 仍保留的 mock 变成显式调试模式。

---

## P7 后台与稳定性收尾

### [~] TW-BE-020 建立最小后台只读排查能力

预计工期：1 到 2 天

目标：

1. 建立后台只读查询面板或只读接口。
2. 支撑玩家状态、钱包流水、订单、战报排查。
3. 为联调和线上问题定位提供最小可见性。

前置文档：

1. [docs/dev/TrinityWar 首批 Admin API 契约清单 v0.1.md](TrinityWar 首批 Admin API 契约清单 v0.1.md)
2. [docs/dev/TrinityWar 管理后台首批只读视图与排障面板规划 v0.1.md](TrinityWar 管理后台首批只读视图与排障面板规划 v0.1.md)

建议 AI 操作范围：

1. admin readonly controller 或后台页面。
2. player、wallet、raid order、battle report 只读 query service。
3. 后台权限占位或开发环境保护。
4. 相关 DTO 与测试。

产出要求：

1. 可查询玩家主状态。
2. 可查询关键流水、订单、战报。
3. 排查接口默认只读。
4. 不加入任何后台写操作。

最小验证建议：

1. 执行 admin readonly 相关测试。
2. 请求玩家状态查询接口。
3. 请求钱包流水、订单、战报查询接口。
4. 确认接口没有写入副作用。

验收清单：

1. [ ] 可查询玩家主状态。
2. [ ] 可查询关键流水和订单。
3. [ ] 排查接口默认只读。

---

## P6.5 灵宠体系建设插入项

以下任务是根据灵宠等级养成与五行战斗方案补入的插入排期。它们必须放在 TW-BE-021 收尾稳定之前完成，或至少明确标记为阻塞和未验收项，避免最终封板时仍沿用旧“灵宠数量/造兵/折损”口径。

### [~] TW-BE-SPIRIT-001 落地灵宠、兽魂、精魄与图鉴数据结构

预计工期：1 到 2 天

目标：

1. 把旧 `PlayerArmy` / `ArmyTrainingQueue` 的数量型口径迁移为“兽魂库存 + 灵宠栏位 + 图鉴精魄”结构。
2. 支撑 5 个兽栏位、单宠主位出战、首宠三选一、100 精魄待合成、已拥有与曾拥有记录。
3. 落地首批普通 9、稀有 6、传说 3 的静态宠物池。

前置文档：

1. [docs/design/Trinity War 灵宠等级养成与五行战斗设计草案 v0.1.md](../design/Trinity%20War%20灵宠等级养成与五行战斗设计草案%20v0.1.md)
2. [docs/dev/TrinityWar 首批数据库表与 Prisma Schema 草案 v0.1.md](TrinityWar 首批数据库表与 Prisma Schema 草案 v0.1.md)
3. [docs/dev/TrinityWar 首批数据库 Migration 切分计划 v0.1.md](TrinityWar 首批数据库 Migration 切分计划 v0.1.md)

建议 AI 操作范围：

1. `services/game-server/prisma/schema.prisma`
2. 新增 migration。
3. 灵宠静态数据 seed。
4. `packages/shared` 中与灵宠读写相关的 DTO 初稿。

产出要求：

1. 有玩家级兽魂库存或等价资源字段。
2. 有玩家灵宠栏位状态，字段至少覆盖：品种、栏位、主位标记、等级、经验或当前升级进度、五行、当前血量、最大血量、状态、版本号。
3. 有玩家图鉴或精魄状态，字段至少覆盖：是否见过、精魄数量、是否待合成、是否已拥有、是否曾拥有。
4. 精魄单宠上限为 100，待合成后不继续累计的约束有明确规则落点。
5. 不再新增“灵宠数量训练队列”作为主成长结构。

最小验证建议：

1. 执行 `prisma generate`。
2. 执行新增 migration。
3. 执行 seed，确认 18 个宠物静态池存在。
4. 查询测试账号，确认初始首宠/空栏位/图鉴状态可生成。

验收清单：

1. [ ] 灵宠栏位结构已落地。
2. [ ] 兽魂库存不再混同于灵宠数量。
3. [ ] 图鉴和精魄状态可持久化。
4. [ ] 首批 18 只宠物静态数据齐备。
5. [ ] 旧造兵队列不再作为灵宠主线依赖。

### [~] TW-BE-SPIRIT-002 接通灵宠读模型与养成命令接口

预计工期：1 到 2 天

目标：

1. 为灵宠页面提供稳定读模型，覆盖兽魂库存、主宠、兽栏、图鉴、待合成池、恢复次数。
2. 接通购买兽魂、升级、设为主位、天机符恢复、解散、合成入栏等命令。
3. 所有高价值命令具备版本校验、幂等和审计日志。

前置文档：

1. [docs/design/Trinity War 灵宠等级养成与五行战斗设计草案 v0.1.md](../design/Trinity%20War%20灵宠等级养成与五行战斗设计草案%20v0.1.md)
2. [docs/dev/TrinityWar 首批写链路事务与幂等策略清单 v0.1.md](TrinityWar 首批写链路事务与幂等策略清单 v0.1.md)
3. TW-BE-SPIRIT-001。

建议 AI 操作范围：

1. spirit query service、assembler、controller。
2. spirit command service。
3. wallet、inventory、audit、idempotency 复用入口。
4. 前端共享类型与 API client 契约。

建议接口契约：

1. `GET /client/spirit` 或并入 `scene-content.army/spirit`：返回兽魂、兽栏、图鉴摘要、待合成池、每日恢复用量。
2. `POST /client/spirit/buy-soul`：金币购买兽魂，替代旧 `recruit-army` 主线。
3. `POST /client/spirit/upgrade`：消耗兽魂，按 1 到 50 级曲线升级。
4. `POST /client/spirit/set-main`：调整主位，保持单宠出战。
5. `POST /client/spirit/recover`：消耗天机符全额恢复，校验每日次数。
6. `POST /client/spirit/dissolve`：解散并返还部分通用兽魂。
7. `POST /client/spirit/compose`：从待合成池选择宠物、空栏位和五行后入栏。

产出要求：

1. 灵宠升级不再依赖主城等级。
2. 等级封顶 50，升级只提升攻防血基础成长。
3. 合成入口语义为“空栏位入栏”，图鉴只展示状态，不直接发宠。
4. 快速恢复只走天机符，不提供金币恢复。
5. 旧 `recruit-army` 若保留，只能作为兼容层或调试入口，不能继续主导前端灵宠页。

最小验证建议：

1. 执行 spirit command/query 相关测试。
2. 手动请求灵宠读接口。
3. 分别验证购买兽魂、升级、设主位、恢复、合成、解散成功路径。
4. 对升级、恢复、合成验证幂等重试不重复扣资源。

验收清单：

1. [ ] 灵宠页面所需读模型字段齐备。
2. [ ] 购买兽魂替代旧培育数量主线。
3. [ ] 升级曲线与 50 级封顶生效。
4. [ ] 合成只能从空栏位触发。
5. [ ] 恢复命令只消耗天机符并限制每日次数。

### [~] TW-BE-SPIRIT-003 接通掠夺目标灵宠情报与深度窥视接口

预计工期：1 到 2 天

目标：

1. 掠夺目标列表和目标详情默认只展示对手主战灵宠卡面外观与等级，不展示五行、状态和精确攻防。
2. 深度窥视返回五行属性、攻击评级、防御评级和当前状态。
3. 实现每日免费 3 次深度窥视 + 天机符追加 3 次的限制。

前置文档：

1. [docs/design/Trinity War 灵宠等级养成与五行战斗设计草案 v0.1.md](../design/Trinity%20War%20灵宠等级养成与五行战斗设计草案%20v0.1.md)
2. [docs/dev/TrinityWar Battle Report 与 Raid Page 前端联调字段清单 v0.1.md](TrinityWar Battle Report 与 Raid Page 前端联调字段清单 v0.1.md)
3. TW-BE-SPIRIT-001。

建议 AI 操作范围：

1. raid target query assembler。
2. deep-intel command/query service。
3. 玩家每日窥视次数记录。
4. `packages/shared` 中 raid target 与 intel DTO。

建议接口契约：

1. `ClientRaidTarget` 增加 `mainPetPreview`：卡面外观或头像资源、等级，可选品种内部标识。
2. `ClientRaidTargetDetailResponse` 增加 `mainPetPreview`，但默认不返回五行、血量状态和精确攻防。
3. `POST /client/raid-targets/:targetId/deep-intel`：按 `raid` / `revenge` / `retry` 场景消耗次数，返回 `element`、`attackRating`、`defenseRating`、`healthStatus`、`remainingFreeIntel`、`remainingTalismanIntel`。
4. 深度窥视结果只对当前挑战上下文有效，每次挑战、再次挑战和复仇都需要重新窥视。

产出要求：

1. 默认情报不泄露五行和状态。
2. 深度窥视不返回精确攻防数值。
3. 免费次数和天机符次数都可持久化并按日重置。
4. 目标主宠字段不再复用主城等级或旧 combatPower 文案。

最小验证建议：

1. 执行 raid target detail 与 deep-intel 相关测试。
2. 手动请求目标详情，确认默认字段不泄露。
3. 连续请求深度窥视，确认免费 3 次后进入天机符追加限制。
4. 天机符不足时返回明确错误。

验收清单：

1. [ ] 目标列表能显示真实主宠卡面外观与等级。
2. [ ] 目标详情默认不展示五行和状态。
3. [ ] 深度窥视字段符合设计。
4. [ ] 免费和天机符次数限制生效。
5. [ ] 每次挑战上下文需要重新窥视。

### [~] TW-BE-SPIRIT-004 接入五行战斗结算、七档结果、扣血与精魄掉落

预计工期：2 到 3 天

目标：

1. raid settlement 从旧战力比/灵宠数量折损切换为灵宠等级、模板、稀有度、阵营加成、五行克制、当前血量的综合结算。
2. 掠夺结果采用完胜、大胜、小胜、相持、小败、大败、完败七档。
3. 同步结算金币、种子、兽魂、精魄掉落和双方灵宠血量变化。

前置文档：

1. [docs/design/Trinity War 灵宠等级养成与五行战斗设计草案 v0.1.md](../design/Trinity%20War%20灵宠等级养成与五行战斗设计草案%20v0.1.md)
2. [docs/dev/TrinityWar 掠夺订单与异步结算专项设计 v0.1.md](TrinityWar 掠夺订单与异步结算专项设计 v0.1.md)
3. TW-BE-SPIRIT-001 到 TW-BE-SPIRIT-003。

建议 AI 操作范围：

1. raid settlement rule service。
2. battle report assembler。
3. spirit repository 与 shard drop service。
4. worker settlement 测试。

产出要求：

1. 先计算等级、稀有度和模板基础攻防血。
2. 同阵营加成先进入静态面板：仙界防御 +8%，魔界攻击 +8%，人界血量 +8%。
3. 五行克制后进入动态战斗修正：克制方攻击 +80%、防御 +50%，被克方攻击 -25%、防御 -25%。
4. 战后扣血按七档区间结算，并持久化当前血量。
5. 兽魂来自灵宠对战结果，金币/种子来自偷菜收益，精魄按普通、稀有、传说掉率分层。
6. 战报使用“白话主档 + 仙侠副标题”，并包含金币、种子、兽魂、扣血和可选精魄摘要。

最小验证建议：

1. 执行 settlement rule 单元测试，覆盖正克、被克、同等级相持、残血出战、跨阵营无加成。
2. 投递一笔 raid order，确认 worker 可完成结算。
3. 查询战报，确认七档文案和资源变化一致。
4. 查询双方灵宠当前血量和攻击方兽魂、精魄变化。

验收清单：

1. [ ] 五行强克制生效。
2. [ ] 同阵营加成结算顺序正确。
3. [ ] 七档结果可稳定产出。
4. [ ] 战后扣血持久化。
5. [ ] 兽魂与精魄掉落进入灵宠养成闭环。
6. [ ] 旧“折损 X 只灵宠”文案不再出现在新战报主链路。

### [~] TW-BE-SPIRIT-005 前端灵宠真实联调与旧 army mock 退场

预计工期：1 到 2 天

目标：

1. 让 `apps/game-client` 的灵宠页从本地演示状态切到真实灵宠读模型和命令接口。
2. 移除默认路径上的旧 `ArmyRecruitScreen`、`recruitArmyUnits`、灵宠数量上限和折损文案依赖。
3. 让掠夺情报、深度窥视和战报读取新灵宠字段。

前置文档：

1. [docs/dev/TrinityWar 前端 Mock 数据退场计划 v0.1.md](TrinityWar 前端 Mock 数据退场计划 v0.1.md)
2. TW-BE-SPIRIT-002 到 TW-BE-SPIRIT-004。

建议 AI 操作范围：

1. `apps/game-client/src/ui/scenes/ArmyScene.tsx`
2. `apps/game-client/src/ui/raid/RaidIntelScreen.tsx`
3. `apps/game-client/src/ui/raid/RaidTargetCard.tsx`
4. `apps/game-client/src/ui/ReportCard.tsx`
5. 前端 API client 与 shared types。

产出要求：

1. 灵宠图鉴只展示收集状态；空栏位二级弹框固定展示待合成宠物图标，图标下方只显示当前精魄数量，再展示灵胎期卡面、五行选择和合成按钮。
2. 主宠、兽栏、图鉴、兽魂库存、恢复次数均以后端为准。
3. 升级、设主位、恢复、解散、合成都走后端命令。
4. 掠夺目标主宠字段不再复用玩家主城等级。
5. 掠夺详情二级弹框展示默认主宠卡片，并在卡片中提供深度窥视入口。
6. 深度窥视结果直接回填默认主宠卡片的按钮区域，展示真实返回字段和剩余次数，不再另起弹框。
7. 战报展示七档结果、兽魂收益、扣血和精魄掉落。

最小验证建议：

1. 执行前端类型检查或构建。
2. 启动前后端，完成一轮：购买兽魂 -> 升级 -> 空栏位合成 -> 设主位 -> 深度窥视 -> 发起掠夺 -> 查看战报。
3. 关闭 mock fallback，确认默认链路仍可跑通。

验收清单：

1. [ ] 灵宠页默认不再依赖本地静态宠物状态。
2. [ ] 合成入口位于空栏位二级弹框，每个待合成图标下方常驻显示精魄数量，切换图标只切换下方灵胎期预览卡、五行选择和合成按钮。
3. [ ] 旧数量型灵宠资源不再出现在默认主链路。
4. [ ] 掠夺页和战报页使用新灵宠字段。
5. [ ] 前端 mock 只作为显式调试能力保留。

---

## P6.6 菜田留言板与战报附言延后项

以下任务属于社交表达增强，目标是让掠夺对象和战报更有玩家记忆点。该项默认不阻塞 TW-BE-021 收尾封板，除非产品确认把社交表达纳入首版必交范围。

### [~] TW-BE-SOCIAL-001 接入菜田留言板与掠夺战报附言

预计工期：2 到 4 天

目标：

1. 玩家可以编辑自己的菜田留言板，作为常驻展示语出现在自己的菜田和被掠夺详情中。
2. 掠夺完成后，攻击方可以给对方留下一段预设短句或表情，并在双方战报中展示。
3. 第一版优先使用长度限制、敏感词过滤、预设话术和预设表情，避免直接开放完全自由聊天。

前置文档：

1. [docs/design/Trinity War 游戏设计草案 v0.2.md](../design/Trinity%20War%20游戏设计草案%20v0.2.md)
2. [docs/dev/TrinityWar Battle Report 与 Raid Page 前端联调字段清单 v0.1.md](TrinityWar Battle Report 与 Raid Page 前端联调字段清单 v0.1.md)
3. TW-BE-014 到 TW-BE-017。

建议 AI 操作范围：

1. 玩家 profile / farm display 读写模型。
2. raid target detail assembler。
3. raid report assembler 与战报持久化字段。
4. 预设附言、表情静态配置和敏感词过滤。
5. `packages/shared` 中菜田留言与战报附言 DTO。

建议接口契约：

1. `GET /client/profile/farm-board` 或并入玩家主状态：返回 `farmBoardMessage`、`farmBoardUpdatedAt`、`farmBoardVersion`。
2. `POST /client/profile/farm-board`：编辑自己的菜田留言，校验长度、敏感词和版本号。
3. `ClientRaidTargetDetailResponse` 增加 `targetFarmBoardMessage`，掠夺详情默认展示对方留言板。
4. `POST /client/raid-orders/:orderId/message` 或结算确认阶段增加 `messageTemplateId`、`messageEmojiId`。
5. `ClientBattleReport` 增加 `raidMessage`：包含 `messageTemplateId`、`messageEmojiId`、`messageTextSnapshot`。

产出要求：

1. 菜田留言是玩家自己的常驻展示语，不做实时聊天。
2. 菜田留言长度建议限制在 24 到 40 个中文字符以内，禁止链接、联系方式和异常符号刷屏。
3. 掠夺后附言第一版只允许预设短句和预设表情，可存文本快照，避免后续文案库调整影响旧战报。
4. 战报中能同时看到掠夺结果和攻击方留下的附言/表情。
5. 需要预留举报、屏蔽或隐藏入口的字段空间，但首版可以只做服务端过滤和客户端隐藏占位。

最小验证建议：

1. 编辑自己的菜田留言，刷新后仍能看到。
2. 请求掠夺详情，确认能看到目标玩家留言板。
3. 完成一次掠夺后选择预设附言和表情，确认双方战报都能展示。
4. 输入超长、敏感词、链接和空白内容，确认被拦截或规范化。
5. 修改预设文案后，旧战报仍展示历史快照。

验收清单：

1. [ ] 玩家可以编辑自己的菜田留言板。
2. [ ] 掠夺详情能展示目标玩家留言。
3. [ ] 掠夺后可选择预设短句和表情。
4. [ ] 战报能展示当次掠夺附言快照。
5. [ ] 长度、敏感词、链接和异常符号限制生效。

### [~] TW-BE-021 收尾稳定与验收封板

预计工期：1 到 2 天

目标：

1. 收口遗留错误码、日志缺口、接口不一致项。
2. 进行一轮系统性联调验收。
3. 形成“首版可持续开发基线”。

前置文档：

1. 本排期表前面所有已完成项。
2. [docs/dev/TrinityWar AI 后端总计划 v0.1.md](TrinityWar AI 后端总计划 v0.1.md)

建议 AI 操作范围：

1. 错误码、日志、接口契约不一致修正。
2. 端到端联调脚本或验收清单。
3. 文档中的最终状态记录。
4. 不新增大功能。

产出要求：

1. 主循环读写链路贯通。
2. 关键写操作具备事务、幂等、日志。
3. raid 异步结算可跑通。
4. 前端默认主链路不长期依赖 mock。
5. 有最小后台排查能力。

最小验证建议：

1. 执行后端测试、类型检查或构建。
2. 执行前端测试、类型检查或构建。
3. 完成一轮登录、读取首页、读取场景、执行核心命令、raid 结算、后台查询的联调。
4. 记录仍未覆盖的风险项。

验收清单：

1. [ ] 主循环读写链路已贯通。
2. [ ] 关键写操作具备事务、幂等、日志。
3. [ ] raid 异步结算可跑通。
4. [ ] 前端默认主链路不再长期依赖 mock。
5. [ ] 有最小后台排查能力。

以下补录项来自 2026-05-19 代码复核。若这些补录项未完成，则 TW-BE-021 不得视为验收封板完成。

---

## P7.1 复核补录项

以下任务用于承接 2026-05-19 对 18-21、灵宠与留言板完成情况的复核发现。目标不是扩展新范围，而是把“已落地但未闭环”的实现补齐到可联调、可构建、可验收状态。

### [x] TW-BE-022 修复测试前端 shared 契约漂移与构建阻塞

预计工期：0.5 到 1 天

目标：

1. 修复 `apps/game-client` 与 `packages/shared` 之间新增字段后的类型漂移。
2. 让测试前端重新恢复可构建、可继续联调的基线状态。
3. 明确 mock 数据在新增字段下的最小维护策略，避免再次因契约补充导致前端直接失编。

前置文档：

1. TW-BE-018 到 TW-BE-021。
2. [docs/dev/TrinityWar 前端 Mock 数据退场计划 v0.1.md](TrinityWar 前端 Mock 数据退场计划 v0.1.md)

建议 AI 操作范围：

1. `apps/game-client/src/mockData.ts`
2. `apps/game-client/src/api.ts`
3. `packages/shared`
4. 必要的前端 README 或环境开关说明。

产出要求：

1. `ClientSceneContentResponse.raid.messageTemplates` 在测试前端 mock 中补齐。
2. `ClientRaidTargetDetailResponse.targetFarmBoardMessage` 在测试前端 mock 中补齐。
3. 测试前端构建恢复通过。
4. 不借此回退 shared 契约或删除已接入的真实字段。

最小验证建议：

1. 执行 `npm run build --workspace @trinitywar/game-client`。
2. 如保留 mock fallback，手动进入目标详情页确认不会因缺字段报错。

验收清单：

1. [ ] 测试前端恢复可构建。
2. [ ] mock 数据已覆盖新增 shared 字段。
3. [ ] 未通过删字段或放宽类型掩盖问题。

### [~] TW-BE-023 接通灵宠真实主链路并移除旧 army 默认路径

预计工期：1 到 2 天

目标：

1. 让灵宠页默认读取真实灵宠模型，而不是本地静态演示状态。
2. 让购买兽魂、升级、设主位、恢复、合成、解散等行为走后端真实接口。
3. 将旧 `recruit-army`、数量型培育和本地 `ArmyScene` 状态降为兼容层或显式调试入口。

前置文档：

1. TW-BE-SPIRIT-001。
2. TW-BE-SPIRIT-002 到 TW-BE-SPIRIT-005。
3. [docs/design/Trinity War 灵宠等级养成与五行战斗设计草案 v0.1.md](../design/Trinity%20War%20灵宠等级养成与五行战斗设计草案%20v0.1.md)

建议 AI 操作范围：

1. `services/game-server` 中灵宠 query / command / controller。
2. `packages/shared` 中灵宠 DTO 与命令契约。
3. `apps/game-client/src/App.tsx`
4. `apps/game-client/src/ui/scenes/ArmyScene.tsx`
5. 测试前端 API client 与默认路由。

产出要求：

1. 存在真实灵宠读接口与命令接口，且测试前端默认消费这些接口。
2. 测试前端默认路径不再调用旧 `recruit-army` 作为灵宠主入口。
3. 本地静态灵宠、图鉴、首宠、合成与恢复状态不再主导默认渲染结果。
4. 旧 army 逻辑若保留，只能作为兼容层或调试模式入口。

最小验证建议：

1. 执行后端类型检查或构建。
2. 执行前端构建。
3. 启动前后端，完成一轮灵宠读取与至少两个核心命令联调。

验收清单：

1. [ ] 灵宠页默认读取真实后端模型。
2. [ ] 旧 `recruit-army` 不再主导灵宠页默认主链路。
3. [ ] 购买兽魂、升级、设主位、恢复、合成等命令已真实联调。
4. [ ] 本地静态灵宠状态不再与真实结果竞争。

### [~] TW-BE-024 接通掠夺灵宠情报、留言板与战报附言的真实前端消费

预计工期：1 到 2 天

目标：

1. 让掠夺目标卡、目标详情、深度窥视、留言板和战报附言读取真实后端字段。
2. 移除掠夺页中按 `targetId` 写死的主宠展示与深度窥视结果。
3. 让战报页面实际展示附言快照与新战斗结果口径，而不是仅保留旧摘要文案。

前置文档：

1. TW-BE-SPIRIT-003 到 TW-BE-SPIRIT-005。
2. TW-BE-SOCIAL-001。
3. [docs/dev/TrinityWar Battle Report 与 Raid Page 前端联调字段清单 v0.1.md](TrinityWar Battle Report 与 Raid Page 前端联调字段清单 v0.1.md)

建议 AI 操作范围：

1. `apps/game-client/src/ui/raid/RaidTargetCard.tsx`
2. `apps/game-client/src/ui/raid/RaidIntelScreen.tsx`
3. `apps/game-client/src/ui/ReportCard.tsx`
4. `apps/game-client/src/ui/scenes/ReportScene.tsx`
5. 必要的 shared DTO 与后端 assembler。

产出要求：

1. 掠夺目标卡不再用主城等级冒充主宠等级。
2. 目标详情展示真实留言板字段。
3. 深度窥视结果来自真实接口，而不是本地常量表。
4. 战报页面可展示真实 `raidMessage` 快照，并兼容七档结果口径。

最小验证建议：

1. 执行前端构建。
2. 启动前后端，完成一轮打开目标详情、查看留言板、深度窥视、完成掠夺、查看战报附言的联调。

验收清单：

1. [ ] 掠夺页主宠信息来自真实字段。
2. [ ] 留言板已在目标详情真实展示。
3. [ ] 深度窥视不再依赖本地写死数据。
4. [ ] 战报可展示附言快照和新结果口径。

### [~] TW-BE-025 接通管理后台只读排查前端

预计工期：0.5 到 1.5 天

目标：

1. 让 `apps/game-admin` 不再只是静态占位页，而是接入最小只读排查能力。
2. 覆盖 overview、system status、player search、player overview、order detail 中至少一条完整排查路径。
3. 验证 TW-BE-020 的后端只读接口确实能被测试前端消费。

前置文档：

1. TW-BE-020。
2. [docs/dev/TrinityWar 管理后台首批只读视图与排障面板规划 v0.1.md](TrinityWar 管理后台首批只读视图与排障面板规划 v0.1.md)

建议 AI 操作范围：

1. `apps/game-admin/src/main.tsx`
2. `apps/game-admin/src/styles.css`
3. `packages/shared` 中 admin DTO。
4. 必要的 admin API client。

产出要求：

1. 管理后台至少能请求并展示 overview 与 system status。
2. 至少有一个玩家检索与详情查看入口。
3. 不新增任何后台写操作。
4. 如启用 `ADMIN_DEBUG_KEY`，前端有明确的请求头注入或调试说明。

最小验证建议：

1. 执行 `npm run build --workspace @trinitywar/game-admin`。
2. 启动后台前端与后端，手动完成 overview、system status、player search 的最小联调。

验收清单：

1. [ ] 后台测试前端不再只是占位页。
2. [ ] 至少一条只读排查路径已跑通。
3. [ ] 未引入后台写操作。
4. [ ] TW-BE-020 的接口与测试前端形成闭环。

## 九、推荐验收打法

每完成一个任务，建议只问六件事：

1. 这轮有没有越界改动。
2. 这轮有没有最小可执行验证。
3. 这轮的产出是否真的支撑下一项任务。
4. 这轮是否留下了必须先补的阻塞。
5. 这轮是否把未验证内容说清楚。
6. 这轮是否更新了执行记录。

如果这六个问题里有任意一个答不上来，就不要把任务状态改成 `[x]`。

## 十、当前建议起跑顺序

如果今天开跑，建议第一批严格按下面顺序发给 AI：

1. TW-BE-001
2. TW-BE-002
3. TW-BE-003
4. TW-BE-004
5. TW-BE-005
6. TW-BE-006

原因：

1. 这 6 项完成后，后端才真正具备“正式接库”的起跑资格。
2. 在这之前直接做大规模接口联调，返工概率很高。
3. P3 之后的读接口、P4 之后的写链路、P5 的异步结算，都依赖这 6 项形成稳定基线。
