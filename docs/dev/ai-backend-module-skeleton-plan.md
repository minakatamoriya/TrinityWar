# TrinityWar 首批 NestJS 模块拆分与目录骨架规划 v0.1

## 一、文档目的

这份文档是给 AI 和开发执行用的模块拆分与目录骨架规划。

它解决的是下面这几个非常实际的问题：

1. 正式后端第一版到底应该拆哪些 NestJS 模块。
2. 每个模块各自负责什么，不负责什么。
3. 哪些模块先建，哪些模块后建。
4. 模块之间允许怎样依赖，哪些依赖不允许出现。
5. AI 每一轮应该生成哪些文件，避免一次生成过大范围代码。

这份文档默认建立在以下文档之上：

1. 总计划：[dev/ai-backend-master-plan.md](dev/ai-backend-master-plan.md)
2. 数据模型规划：[dev/ai-backend-prisma-schema-plan.md](dev/ai-backend-prisma-schema-plan.md)
3. 接口契约规划：[dev/ai-backend-api-contract-plan.md](dev/ai-backend-api-contract-plan.md)
4. Service 分层规划：[dev/ai-backend-service-plan.md](dev/ai-backend-service-plan.md)

## 二、模块拆分总原则

### 1. 按业务边界拆，不按页面名字机械拆

模块应该围绕稳定业务边界，而不是围绕某个前端页面临时拆。

例如：

1. building 模块是稳定边界。
2. wallet 模块是稳定边界。
3. task 模块是稳定边界。

但 `home-page` 不是一个好的后端模块边界，因为首页本来就是聚合多个领域状态。

### 2. 读聚合和写动作可以依赖多个模块，但核心状态归属只能有一个主模块

例如：

1. 首页聚合可以读取 wallet、building、task。
2. 场景聚合可以读取 building、field、army、raid、faction。

但：

1. 建筑等级的主写入口必须归 building。
2. 钱包余额主写入口必须归 wallet。
3. 每日任务状态主写入口必须归 task。

### 3. 不要为“以后可能有用”过早拆太细

第一版不需要把所有内容拆成几十个 package。

当前阶段最稳的方案仍是：

1. NestJS 单体应用。
2. 明确模块边界。
3. 在单体内保持清晰目录结构。

### 4. 允许 query service 做跨模块聚合，但不允许跨模块私自改对方状态

例如：

1. `HomeSummaryQueryService` 可以读取多个模块 repository。
2. `SceneContentQueryService` 可以读取多个模块 repository。

但不允许：

1. building 模块直接偷偷改 task 状态。
2. raid 模块直接绕过 wallet 规则改余额。
3. worker 直接跳过 use case 改 building 和 wallet。

## 三、首批模块总览

建议第一版按下面 15 个模块组织。

## 1. app 模块

### 职责

1. 应用入口。
2. 全局配置。
3. 全局 filter、guard、interceptor 注册。
4. 健康检查。
5. Swagger 初始化。

### 不负责

1. 任何具体业务规则。

## 2. auth 模块

### 职责

1. 微信登录。
2. 开发环境假登录。
3. token 签发与校验。
4. 当前玩家上下文注入。

### 不负责

1. 玩家主状态读取。
2. 钱包结算。
3. 建筑升级。

## 3. player 模块

### 职责

1. 玩家基础资料。
2. 新玩家建档。
3. 玩家基础摘要信息。

### 不负责

1. 钱包变更结算。
2. 建筑升级规则。
3. 战斗结算。

## 4. wallet 模块

### 职责

1. 金库余额。
2. 待领取税收。
3. 待领取分红。
4. 待领取掠夺溢出。
5. 资产日志。

### 不负责

1. 建筑升级条件判断。
2. 训练队列管理。
3. 地块生命周期管理。

## 5. building 模块

### 职责

1. 主城等级。
2. 金库等级。
3. 灵宠上限等级。
4. 防守建筑等级。
5. 建筑扩展分支等级。
6. 建筑升级日志。

### 不负责

1. 钱包主写规则。
2. 农场收菜。
3. 掠夺结算。

## 6. field 模块

### 职责

1. 地块解锁状态。
2. 播种。
3. 成长阶段。
4. 收取。
5. 地块版本控制。

### 不负责

1. 建筑升级。
2. 阵营上缴。
3. 掠夺订单。

## 7. seed 模块

### 职责

1. 种子库存。
2. 种子解锁状态。
3. 种子图鉴基础读模型。

### 不负责

1. 地块阶段推进。
2. 钱包主写结算。

## 8. army 模块

### 职责

1. 当前可用兵力。
2. 训练中队列。
3. 兵力冻结。
4. 训练完成状态。

### 不负责

1. 掠夺目标池维护。
2. 分红结算。
3. 建筑升级。

## 9. raid 模块

### 职责

1. 目标池。
2. 发起掠夺。
3. 掠夺订单。
4. 掠夺结算。
5. 保护期。
6. 复仇资格。

### 不负责

1. 玩家登录。
2. 建筑升级。
3. 每日任务刷新。

## 10. report 模块

### 职责

1. 战报读取。
2. 战报摘要。
3. 战报详情。

### 不负责

1. 真正执行掠夺结算。

## 11. faction 模块

### 职责

1. 阵营成员关系。
2. 阵营公库。
3. 上缴。
4. 贡献值。
5. 分红系数。

### 不负责

1. 每日任务刷新。
2. 农场收菜。

## 12. task 模块

### 职责

1. 每日任务状态。
2. 任务进度推进。
3. 任务奖励领取。
4. 跨天刷新。

### 不负责

1. token 鉴权。
2. 掠夺订单管理。

## 13. leaderboard 模块

### 职责

1. 排行榜快照读取。
2. 排行榜刷新任务。

### 不负责

1. 阵营上缴规则。
2. 掠夺即时结算。

## 14. admin 模块

### 职责

1. 调试查询。
2. 运营后台只读接口。
3. 受控修正接口。

### 不负责

1. 自带另一套业务规则。

## 15. job / audit 模块

### job 模块职责

1. BullMQ queue 注册。
2. Worker 入口。
3. 定时任务调度。

### audit 模块职责

1. 资源变更日志。
2. 建筑升级日志。
3. 掠夺结算日志。
4. 后台修正日志。

## 四、模块依赖方向

### 1. 允许依赖方向

推荐依赖方向如下：

1. controller -> use case
2. use case -> domain service
3. use case -> repository
4. query service -> repository
5. assembler -> shared dto
6. worker -> use case

### 2. 不允许依赖方向

下面这些依赖应尽量禁止：

1. repository -> controller
2. repository -> assembler
3. domain service -> NestJS request context
4. worker -> repository 直接改多张业务表而不经过 use case
5. controller -> PrismaService 直接写数据库

### 3. 跨模块依赖建议

首版允许的跨模块依赖应该是“少量、明确、可追踪”的。

例如：

1. building use case 依赖 wallet repository 做扣费。
2. collect-field use case 依赖 wallet repository 做入账。
3. raid use case 依赖 army repository 和 wallet repository。
4. donate-faction-gold use case 依赖 faction repository 和 wallet repository。

但不建议：

1. field 模块直接自己维护 faction 贡献。
2. raid 模块直接自己维护 task 最终状态。

### 4. 更稳的做法

跨模块协作时，优先通过下面方式实现：

1. 共享 repository 接口。
2. 共享 domain service。
3. 共享 use case 编排。

而不是模块之间互相 import 大量内部文件。

## 五、推荐工程骨架

下面是推荐的第一版目录骨架。

```text
apps/api/
  src/
    main.ts
    app.module.ts
    modules/
      app/
      auth/
      player/
      wallet/
      building/
      field/
      seed/
      army/
      raid/
      report/
      faction/
      task/
      leaderboard/
      admin/
      job/
      audit/
    shared/
      config/
      prisma/
      logging/
      errors/
      guards/
      decorators/
      interceptors/
      filters/
      idempotency/
      versioning/
      assembler/
      constants/
```

### 1. shared/config

建议放：

1. 环境变量 schema。
2. 配置加载。
3. token 配置。
4. Redis 配置。
5. BullMQ 配置。

### 2. shared/prisma

建议放：

1. PrismaService。
2. 事务运行器。
3. Prisma 错误转换。

### 3. shared/errors

建议放：

1. ErrorCode enum。
2. BusinessError。
3. error factory。
4. 全局异常过滤器。

### 4. shared/idempotency

建议放：

1. 幂等键校验服务。
2. 幂等记录 repository 或 adapter。

### 5. shared/versioning

建议放：

1. stateVersion 校验工具。
2. walletVersion / fieldVersion / armyVersion / buildingVersion 校验服务。

## 六、模块内骨架模板

以 building 模块为例，推荐结构如下：

```text
building/
  building.module.ts
  building.controller.ts
  dto/
    requests/
      upgrade-building.request.ts
    responses/
      building-scene.response.ts
  application/
    use-cases/
      upgrade-building.use-case.ts
    services/
      building-scene-query.service.ts
  domain/
    rules/
      building-upgrade-rule.service.ts
      population-gate-rule.service.ts
    constants/
    types/
  infrastructure/
    repositories/
      player-building.repository.ts
      building-upgrade-log.repository.ts
    assemblers/
      building-scene.assembler.ts
```

其他模块也尽量遵守同样骨架。

## 七、首批必建模块和顺序

第一版不应该一口气把 15 个模块都做完。

建议按下面顺序推进。

## 第 1 批：底座模块

1. app
2. auth
3. player
4. shared/prisma
5. shared/errors
6. shared/config

### 目标

1. 服务能启动。
2. 能登录。
3. 能拿到当前 playerId。
4. Prisma 可用。
5. Swagger 可用。

## 第 2 批：核心状态模块

1. wallet
2. building
3. field
4. seed
5. army

### 目标

1. 首页读接口可接真实库。
2. 建筑页、农场页、部队页读接口可接真实库。
3. 核心状态从内存迁到数据库。

## 第 3 批：核心写链路模块

1. building 升级
2. field 播种
3. field 收取
4. army 训练
5. wallet 待领取领取
6. task 奖励领取
7. faction 上缴

### 目标

1. 关键操作链路具备事务。
2. 关键操作具备日志。
3. 幂等和版本校验进入主链路。

## 第 4 批：复杂模块

1. raid
2. report
3. task 刷新
4. faction 分红
5. leaderboard
6. job
7. audit

### 目标

1. 掠夺系统正式化。
2. 战报可追踪。
3. 定时任务可运行。
4. 排行榜和分红进入异步系统。

## 第 5 批：后台模块

1. admin
2. audit 查询
3. debug 只读接口

### 目标

1. 可排障。
2. 可查日志。
3. 可做受控修正。

## 八、每一批 AI 应该只生成什么

### 1. 第 1 批 AI 任务边界

每轮只生成一个模块骨架，例如：

1. auth module + auth controller + auth service skeleton
2. shared/prisma + prisma service
3. shared/errors + business error 基础结构

不要在这一批就写具体 building、field、raid 规则。

### 2. 第 2 批 AI 任务边界

每轮只生成：

1. 一个 repository 集合。
2. 一个 query service。
3. 一个 assembler。

不要一轮同时写多个写链路。

### 3. 第 3 批 AI 任务边界

每轮只生成一条命令链路，例如：

1. upgrade-building 全链路。
2. collect-field 全链路。
3. claim-pending 全链路。

每条链路必须自带：

1. DTO
2. use case
3. rule service
4. repositories
5. transaction
6. minimal test plan

### 4. 第 4 批 AI 任务边界

raid 和 job 相关一轮只做一个闭环。

例如：

1. 只做 raid order 创建。
2. 只做 raid settlement。
3. 只做 daily task refresh worker。

不要一口气生成整套 raid 全部代码。

## 九、推荐首批 controller 清单

第一版建议优先具备下面这些 controller。

### 1. AuthController

建议接口：

1. POST /api/client/auth/login
2. POST /api/client/auth/dev-login
3. GET /api/client/me

### 2. ClientBootstrapController 或 ClientReadController

建议接口：

1. GET /api/client/bootstrap
2. GET /api/client/home-summary
3. GET /api/client/scene-content
4. GET /api/client/raid-targets/:targetId

### 3. ClientActionController

建议接口：

1. POST /api/client/actions/claim-pending
2. POST /api/client/actions/claim-daily-task
3. POST /api/client/actions/claim-starter-seeds
4. POST /api/client/actions/claim-tianji-talisman
5. POST /api/client/actions/collect-field
6. POST /api/client/actions/start-cultivation
7. POST /api/client/actions/recruit-army
8. POST /api/client/actions/raid-target
9. POST /api/client/actions/faction-donate
10. POST /api/client/actions/upgrade-building

### 4. AdminDebugController

建议接口：

1. GET /api/client/admin/debug-state
2. 若正式环境默认关闭，则仅本地测试开启

## 十、推荐首批 use case 清单

首批建议明确落成独立 use case 的动作如下：

1. LoginUseCase
2. DevLoginUseCase
3. BootstrapPlayerUseCase
4. GetHomeSummaryUseCase 或 HomeSummaryQueryService
5. GetSceneContentUseCase 或 SceneContentQueryService
6. UpgradeBuildingUseCase
7. StartCultivationUseCase
8. CollectFieldUseCase
9. RecruitArmyUseCase
10. ClaimPendingGoldUseCase
11. ClaimDailyTaskRewardUseCase
12. ClaimStarterSeedsUseCase
13. ClaimTianjiTalismanUseCase
14. DonateFactionGoldUseCase
15. RaidTargetUseCase

## 十一、推荐首批 repository 清单

建议首批先把这些 repository 做出来：

1. PlayerRepository
2. PlayerAuthIdentityRepository
3. PlayerWalletRepository
4. PlayerBuildingRepository
5. PlayerFieldSlotRepository
6. PlayerSeedInventoryRepository
7. PlayerArmyRepository
8. PlayerDailyTaskRepository
9. FactionRepository
10. FactionMemberRepository
11. RaidTargetPoolRepository
12. RaidOrderRepository
13. BattleReportRepository
14. WalletChangeLogRepository
15. BuildingUpgradeLogRepository
16. TaskRewardLogRepository
17. SystemJobLogRepository

## 十二、模块联调顺序建议

不要按“后端全部写完再连前端”的方式推进。

建议顺序是：

1. 先把 auth + bootstrap + home-summary 打通。
2. 再打通 scene-content 读取。
3. 再逐条替换写接口。
4. 每替换一条写接口，就回前端验证该页面。
5. 等 raid 和 job 成熟后，再做复杂异步逻辑联调。

## 十三、AI 执行模板

### 1. 生成模块骨架

你现在只负责生成 [模块名] 的 NestJS 模块骨架。范围只包括 module、controller、dto 目录、application/domain/infrastructure 空骨架和必要 provider 注册。不要生成与当前模块无关的业务代码。

### 2. 生成 query service

你现在只负责生成 [模块名/页面名] query service。目标是读取 repository 并返回 shared DTO 所需数据。不要在这个任务中生成写链路。

### 3. 生成命令链路

你现在只负责生成 [动作名] 命令链路。必须包含请求 DTO、controller 接口、use case、rule service、repository 依赖、事务边界、错误码映射和最小验证步骤。不要顺便改其他动作。

### 4. 生成 worker 骨架

你现在只负责生成 [任务名] worker 骨架。只能接 queue/job 并调用既有 use case，不要在 worker 中复制主业务规则。

## 十四、验收清单

当 AI 完成一轮模块规划或模块骨架实现后，至少检查：

1. 模块职责是否单一。
2. controller 是否足够薄。
3. 目录结构是否和 service 分层规划一致。
4. 是否出现 repository 越权做业务判断。
5. 是否出现 worker 复制规则。
6. 是否出现 query service 和 use case 混写。
7. 是否出现跨模块私改对方核心状态。
8. 新增模块是否真的能承接一条清晰业务链路。

## 十五、最建议的下一份规划文档

如果后面还继续只写规划，不落代码，那么最自然的下一份文档应该是：

1. 首批数据库 migration 切分计划。
2. 首批读接口联调切换计划。
3. 首批写链路事务与幂等策略清单。

其中最优先的是第 3 个。

因为真正让 AI 后面容易写对的，不只是模块骨架，而是每条命令链路的事务边界、版本校验点、日志点和幂等点。