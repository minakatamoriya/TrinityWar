# TrinityWar 首批数据库 Migration 切分计划 v0.1

## 一、文档目的

这份文档是给 AI 和开发执行用的数据库 migration 切分计划。

前面的 schema 文档已经回答了“第一批有哪些表”，但还没有把下面这些最容易让 AI 失控的问题彻底写死：

1. migration 到底应该切成几批。
2. 每一批应该只上哪些表和约束。
3. 哪些表必须先上，哪些表必须后上。
4. 哪些索引和唯一约束适合首批就上，哪些更适合延后。
5. 每一批 migration 完成后，后端应该先接哪一段读写链路。
6. 如果某一批设计有误，回滚边界在哪里。

这份文档的目标，不是重复 schema 字段，而是把“数据库变更的落地顺序”安排成 AI 可持续执行的小步任务。

本文件是对 [dev/ai-backend-prisma-schema-plan.md](dev/ai-backend-prisma-schema-plan.md) 中“首批 migration 拆分建议”的细化版，不是替代版。

它同时要和下面几份文档保持一致：

1. 总计划：[dev/ai-backend-master-plan.md](dev/ai-backend-master-plan.md)
2. Prisma/schema 规划：[dev/ai-backend-prisma-schema-plan.md](dev/ai-backend-prisma-schema-plan.md)
3. 接口契约：[dev/ai-backend-api-contract-plan.md](dev/ai-backend-api-contract-plan.md)
4. Service 分层：[dev/ai-backend-service-plan.md](dev/ai-backend-service-plan.md)
5. 模块骨架：[dev/ai-backend-module-skeleton-plan.md](dev/ai-backend-module-skeleton-plan.md)
6. 命令链路事务与幂等：[dev/ai-backend-command-transaction-idempotency-plan.md](dev/ai-backend-command-transaction-idempotency-plan.md)

## 二、切分总原则

### 1. 一批 migration 只解决一类上线目标

不要一批 migration 同时承担：

1. 登录建档。
2. 首页读模型。
3. 农场主状态。
4. 掠夺订单。
5. 审计日志。

这样一旦其中一块有问题，整批都很难回滚。

### 2. 先上“当前状态表”，再上“复杂行为表”，最后补“异步与后台表”

首批稳定目标应该是：

1. 先让登录和玩家建档可用。
2. 再让首页和场景读取可用。
3. 再让核心写链路可用。
4. 最后再把掠夺、异步任务、后台审计补齐。

### 3. 不要把所有日志表都拖到最后

这是最容易犯的错误。

原因是：

1. 核心写链路一旦开始落地，事务内审计日志就必须跟上。
2. 如果日志表都最后再建，AI 后面会很容易先把写链路写成“只有状态，没有审计”。

因此：

1. 和核心写链路强绑定的日志表，应在对应写链路上线前就到位。
2. 只有后台查询类、低频运营类日志，才适合更后面上。

### 4. 第一版 migration 优先稳定结构，不优先极致索引

第一版就必须上的索引：

1. 唯一性约束索引。
2. 高频主读路径索引。
3. 高频状态轮询索引。

第一版可以后补的索引：

1. 复杂后台统计索引。
2. 多字段组合分析索引。
3. 很少用到的模糊检索索引。

### 5. 每一批 migration 完成后，都必须对应一个“可验证能力”

例如：

1. migration 001 完成后，要能建档。
2. migration 003 完成后，要能从数据库读首页和建筑/农场/部队页。
3. migration 005 完成后，要能上线 building upgrade 和 collect field 这类核心写链路。

如果一批 migration 完成后，系统没有获得一个新的可验证能力，那通常说明拆分不合理。

## 三、从粗粒度 4 批到细粒度 7 批

原 schema 文档里的 4 批建议是对的，但粒度对 AI 来说还偏粗。

本次细化后，建议第一版正式执行按 7 批推进：

1. Migration 001：身份与玩家根
2. Migration 002：阵营与成员关系
3. Migration 003：核心当前状态
4. Migration 004：农场与种子子系统
5. Migration 005：核心审计与幂等支撑
6. Migration 006：掠夺与战报
7. Migration 007：异步任务与后台修正

这样拆的原因是：

1. 登录建档可以先独立稳定。
2. 首页和场景读取所需主状态可以比掠夺更早落地。
3. 审计和幂等支撑可以在核心写链路前就先到位。
4. 掠夺和战报能单独作为高风险批次处理。
5. 后台和异步系统最后补，不阻塞前面的主循环验证。

## 四、每批 migration 详细计划

## Migration 001：身份与玩家根

### 目标

1. 跑通登录与建档最小闭环。
2. 先确定玩家聚合根和身份绑定结构。

### 建议包含

1. Player
2. PlayerAuthIdentity

### 首批必须上的约束

1. Player 主键
2. PlayerAuthIdentity 的 `provider + providerUserId` 唯一约束
3. PlayerAuthIdentity 对 playerId 的外键

### 首批必须上的索引

1. Player 的 `lastLoginAt`
2. PlayerAuthIdentity 的 `playerId`

### 本批先不要做

1. 玩家所有当前状态表
2. 钱包表
3. 建筑表
4. 阵营成员表

### 为什么必须先独立一批

因为登录和建档是所有后续模块的前置依赖，而且这部分字段最稳定，返工概率最低。

### 本批完成后应可承接

1. `POST /api/client/auth/login`
2. `POST /api/client/auth/dev-login`
3. `GET /api/client/me` 的最小闭环

### 回滚边界

如果这一批设计有问题，只影响身份和玩家根，不会连带破坏钱包、建筑、农场等主状态表。

## Migration 002：阵营与成员关系

### 目标

1. 建立玩家与阵营的正式关系。
2. 为首页和阵营页的基础数据打底。

### 建议包含

1. Faction
2. FactionMember

### 首批必须上的约束

1. Faction 的 `code` 唯一
2. Faction 的 `name` 唯一
3. FactionMember 的 `factionId + playerId` 唯一

### 首批必须上的索引

1. FactionMember 的 `playerId`
2. Player 的 `factionId`

### 本批先不要做

1. FactionContributionLog
2. FactionDividendLog
3. 排行榜快照

### 为什么不和 Migration 001 合并

因为阵营配置和成员关系比身份模型更容易改口径，单独拆出可以减少登录模型跟着反复改。

### 本批完成后应可承接

1. 玩家建档时挂载阵营
2. 阵营基础读模型
3. 首页阵营摘要的基础字段

### 回滚边界

如果阵营结构要调整，不影响 auth 和 player 根模型。

## Migration 003：核心当前状态

### 目标

1. 把首页、建筑、部队这三类核心当前状态正式落库。
2. 让 `bootstrap`、`home-summary`、`scene-content` 有机会先接真实数据库。

### 建议包含

1. PlayerWallet
2. PlayerBuilding
3. PlayerArmy
3. ArmyTrainingQueue

### 首批必须上的约束

1. PlayerWallet 的 `playerId` 唯一
2. PlayerBuilding 的 `playerId` 唯一
3. PlayerArmy 的 `playerId` 唯一
4. ArmyTrainingQueue 的“同玩家同一时刻最多一条有效队列”约束

### 首批必须上的索引

1. PlayerWallet 的 `pendingRaidOverflowExpiresAt`
2. ArmyTrainingQueue 的 `playerId, status`
3. ArmyTrainingQueue 的 `finishAt`

### 本批必须带上的版本字段

1. PlayerWallet.balanceVersion
2. PlayerBuilding.buildingVersion
3. PlayerArmy.armyVersion

### 本批先不要做

1. Field 相关表
2. Seed 相关表
3. Task 表
4. 掠夺表

### 为什么不把 Field 一起放进这一批

因为钱包/建筑/兵力是最稳定的核心状态，而农场地块的状态机更复杂，也更容易调整。拆开更利于控制变更半径。

### 本批完成后应可承接

1. `GET /api/client/bootstrap`
2. `GET /api/client/home-summary`
3. `GET /api/client/scene-content` 的 building/army 部分
4. building、claim-pending、recruit-army 的前置读模型

### 回滚边界

如果钱包或建筑字段要改，不会连带影响农场与掠夺表。

## Migration 004：农场与种子子系统

### 目标

1. 把农场页和种子图鉴基础数据落库。
2. 为 start-cultivation、collect-field 两条链路准备正式表结构。

### 建议包含

1. SeedDefinition
2. PlayerSeedInventory
3. PlayerFieldSlot
4. PlayerDailyTaskState

### 为什么把 Task 也放这一批

因为收菜、播种很快就会推进任务进度，如果 task 仍缺席，后面 AI 会倾向于先把任务逻辑留在内存里，造成双轨状态。

### 首批必须上的约束

1. SeedDefinition 的 `seedId` 唯一
2. PlayerSeedInventory 的 `playerId + seedDefinitionId` 唯一
3. PlayerFieldSlot 的 `playerId + slotIndex` 唯一
4. PlayerDailyTaskState 的 `playerId + dateKey + taskId` 唯一

### 首批必须上的索引

1. PlayerSeedInventory 的 `playerId`
2. PlayerFieldSlot 的 `playerId, status`
3. PlayerFieldSlot 的 `matureAt`
4. PlayerFieldSlot 的 `fullMatureAt`
5. PlayerFieldSlot 的 `overripeAt`
6. PlayerDailyTaskState 的 `playerId, dateKey`
7. PlayerDailyTaskState 的 `dateKey, status`

### 本批必须带上的版本字段

1. PlayerFieldSlot.statusVersion
2. PlayerSeedInventory 可新增 `inventoryVersion` 或等价 `updatedAt` + 乐观锁策略

### 本批先不要做

1. RaidTargetPool
2. RaidOrder
3. BattleReport
4. FactionContributionLog

### 本批完成后应可承接

1. `GET /api/client/scene-content` 的 field 部分
2. 种子图鉴读取
3. `POST /api/client/actions/start-cultivation`
4. `POST /api/client/actions/collect-field`
5. `POST /api/client/actions/claim-daily-task` 的数据前置

### 回滚边界

农场状态机调整时，不需要动钱包/建筑/兵力表结构。

## Migration 005：核心审计与幂等支撑

### 目标

1. 在核心写链路正式落地前，把事务内必须写的日志和幂等基础设施先建好。
2. 避免后续写链路变成“只有状态表更新，没有审计和重试保护”。

### 建议包含

1. WalletChangeLog
2. BuildingUpgradeLog
3. FieldHarvestLog
4. FactionContributionLog
5. TaskRewardLog 或等价奖励日志表
6. IdempotencyRecord

### 为什么要单独一批

因为这批表本身不是前端页面要直接读的，但它们是正式写链路质量的底座。

如果把它们拖到最后，后面任何一个命令 use case 都容易先走捷径。

### 首批必须上的约束

1. IdempotencyRecord 的 `playerId + endpointKey + idempotencyKey` 唯一
2. 关键日志表对关联实体的外键

### 首批必须上的索引

1. WalletChangeLog 的 `playerId, createdAt`
2. WalletChangeLog 的 `requestIdempotencyKey`
3. BuildingUpgradeLog 的 `playerId, createdAt`
4. FieldHarvestLog 的 `playerId, createdAt`
5. FactionContributionLog 的 `factionId, createdAt`
6. IdempotencyRecord 的 `expiresAt`
7. IdempotencyRecord 的 `status, updatedAt`

### 本批先不要做

1. FactionDividendLog
2. AdminAdjustmentLog
3. SystemJobLog

### 本批完成后应可承接

1. `POST /api/client/actions/upgrade-building`
2. `POST /api/client/actions/claim-pending`
3. `POST /api/client/actions/collect-field`
4. `POST /api/client/actions/start-cultivation`
5. `POST /api/client/actions/recruit-army`
6. `POST /api/client/actions/claim-daily-task`
7. `POST /api/client/actions/faction-donate`

### 回滚边界

即使这批日志结构要调整，也不需要推翻前面主状态表；通常只影响写链路可审计性，而不是基础读模型。

## Migration 006：掠夺与战报

### 目标

1. 把掠夺从 demo 内存逻辑迁到正式持久化结构。
2. 让 raid-target、战报页、保护期、复仇资格有正式数据基础。

### 建议包含

1. RaidTargetPool
2. RaidOrder
3. RaidSettlement
4. BattleReport

### 首批必须上的约束

1. RaidOrder 的 `requestIdempotencyKey` 唯一
2. RaidSettlement 的 `raidOrderId` 唯一

### 首批必须上的索引

1. RaidTargetPool 的 `ownerPlayerId, expiresAt`
2. RaidTargetPool 的 `ownerPlayerId, refreshBatchNo`
3. RaidOrder 的 `attackerPlayerId, status`
4. RaidOrder 的 `defenderPlayerId, status`
5. RaidOrder 的 `settleAt, status`
6. BattleReport 的 `ownerPlayerId, createdAt`
7. BattleReport 的 `raidOrderId`

### 本批先不要做

1. 排行榜快照
2. GM 修正日志
3. 系统 job 日志

### 为什么必须单独一批

掠夺是第一批里最复杂、最容易反复调整的结构。

如果和核心读写链路或后台表混在一起，一旦掠夺逻辑变更，整批 migration 都会被牵连。

### 本批完成后应可承接

1. `GET /api/client/raid-targets/:targetId`
2. `POST /api/client/actions/raid-target`
3. 战报页读取
4. 保护期和复仇资格判断的持久化基础

### 回滚边界

掠夺这批有问题时，可以单独冻结 raid 功能，而不影响 building、field、task、wallet 主循环。

## Migration 007：异步任务与后台修正

### 目标

1. 为 worker、定时刷新、后台排错补齐正式表。
2. 支撑分红、训练完成、跨天刷新、后台修正的可观测性。

### 建议包含

1. FactionDividendLog
2. AdminAdjustmentLog
3. SystemJobLog

### 可选扩展

1. LeaderboardSnapshot
2. QueueOutbox 或事件外发表
3. RefreshBatchLog

### 首批必须上的索引

1. FactionDividendLog 的 `factionId, settledAt`
2. FactionDividendLog 的 `playerId, createdAt`
3. AdminAdjustmentLog 的 `targetPlayerId, createdAt`
4. SystemJobLog 的 `jobName, createdAt`
5. SystemJobLog 的 `status, createdAt`

### 为什么放最后

因为这些表主要服务异步、后台和排障，不是前台主循环的最早阻塞项。

### 本批完成后应可承接

1. 小时分红结算
2. 训练完成 worker
3. 每日任务跨天刷新
4. admin/debug 查询与修正

### 回滚边界

即使后台表设计要调整，也不应影响前台主循环已上线能力。

## 五、每批 migration 后的推荐开发承接顺序

migration 不应该孤立推进，而应该和模块开发顺序对齐。

### 完成 Migration 001 后

建议优先做：

1. auth module 骨架
2. dev-login
3. player context

### 完成 Migration 002 后

建议优先做：

1. faction 基础 repository
2. 建档时阵营挂载
3. 首页阵营摘要读取

### 完成 Migration 003 后

建议优先做：

1. PlayerWalletRepository
2. PlayerBuildingRepository
3. PlayerArmyRepository
4. HomeSummaryQueryService
5. SceneContentQueryService 的 building/army 部分

### 完成 Migration 004 后

建议优先做：

1. PlayerFieldSlotRepository
2. PlayerSeedInventoryRepository
3. PlayerDailyTaskRepository
4. StartCultivationUseCase
5. CollectFieldUseCase

### 完成 Migration 005 后

建议优先做：

1. IdempotencyService
2. VersionCheckService
3. UpgradeBuildingUseCase
4. ClaimPendingGoldUseCase
5. ClaimDailyTaskRewardUseCase

### 完成 Migration 006 后

建议优先做：

1. RaidTargetDetailQueryService
2. RaidTargetUseCase
3. BattleReportQueryService

### 完成 Migration 007 后

建议优先做：

1. DividendSettlementWorker
2. DailyTaskRefreshWorker
3. AdminDebugController

## 六、哪些东西不要太早写进 migration

### 1. 复杂统计索引

例如多维后台分析索引、报表索引。

原因：

1. 首版查询模式还没稳定。
2. 太早上复杂索引会增加 AI 误改和迁移成本。

### 2. 过早抽象的通用事件表

例如试图第一版就做一个“万能 event_store”。

原因：

1. 当前项目还不需要事件溯源级别的复杂度。
2. 更容易让 AI 生成一堆看起来高级但并不实用的结构。

### 3. 过度归档表

例如排行榜历史月表、战报冷热分层、冷数据归档。

这些都不该阻塞首批真实后端闭环。

## 七、每批 migration 的 AI 执行边界

### 1. 生成 Migration 001

你现在只负责生成 Prisma schema 的身份与玩家根部分，以及对应 migration。范围只包括 Player、PlayerAuthIdentity 和必要枚举。不要生成钱包、建筑、农场、掠夺相关模型。

### 2. 生成 Migration 003

你现在只负责生成核心当前状态模型及 migration。范围只包括 PlayerWallet、PlayerBuilding、PlayerArmy、ArmyTrainingQueue 和相关索引、约束、外键。不要扩展到 field、raid、log。

### 3. 生成 Migration 004

你现在只负责生成农场与种子子系统模型及 migration。范围只包括 SeedDefinition、PlayerSeedInventory、PlayerFieldSlot、PlayerDailyTaskState。必须带上关键唯一约束与成熟时间索引。不要生成 raid 或后台日志模型。

### 4. 生成 Migration 005

你现在只负责生成核心审计与幂等支撑模型及 migration。范围只包括 WalletChangeLog、BuildingUpgradeLog、FieldHarvestLog、FactionContributionLog、TaskRewardLog、IdempotencyRecord。不要生成 battle report、admin adjustment、system job log。

### 5. 生成 Migration 006

你现在只负责生成掠夺与战报模型及 migration。范围只包括 RaidTargetPool、RaidOrder、RaidSettlement、BattleReport。必须保证订单幂等键唯一、结算与订单一对一、战报支持 ownerPlayerId 查询。不要顺手扩展后台表。

## 八、每批 migration 的验收清单

每一批 migration 在进入下一批前，至少检查：

1. schema 是否通过 validate。
2. migration SQL 是否只包含当前批次应有的表和索引。
3. 是否没有偷偷夹带下一批的复杂模型。
4. 外键方向是否符合当前模块边界。
5. 唯一约束是否足以支撑业务唯一性。
6. 高频读路径索引是否已经到位。
7. 是否为下一批 use case 或 query service 提供了明确落脚点。
8. 如果当前批回滚，是否不会破坏前一批已经稳定的能力。

## 九、和旧四批方案的对应关系

为了避免文档之间看起来矛盾，这里明确一下：

1. 旧文档中的 Migration 001，对应这里的 Migration 001 + Migration 002。
2. 旧文档中的 Migration 002，对应这里的 Migration 003 + Migration 004。
3. 旧文档中的 Migration 003，对应这里的 Migration 006。
4. 旧文档中的 Migration 004，对应这里的 Migration 005 + Migration 007。

所以本文件不是推翻旧方案，而是把原来 4 个大块拆成了 7 个更适合 AI 逐步执行的小块。

## 十、最建议的实际执行顺序

如果你后面开始让 AI 真正落数据库变更，推荐顺序是：

1. 先落 Migration 001。
2. 再落 Migration 003。
3. 再落 Migration 004。
4. 再落 Migration 005。
5. 之后补 Migration 002。
6. 再落 Migration 006。
7. 最后落 Migration 007。

### 为什么 Migration 002 可以稍后补

因为阵营关系虽然重要，但它对首批登录、首页、建筑、农场、训练的数据库落地不是最强阻塞项。

如果你想尽快让“单玩家真实库联调”先成立，可以先把玩家根、核心状态、农场、审计这条线做完，再补阵营与掠夺。

### 如果你坚持严格按依赖顺序走

也可以按 001 -> 002 -> 003 -> 004 -> 005 -> 006 -> 007 走。

这两种都可以。

我更推荐前一种，因为它更贴近“尽快把主循环接上真实数据库”的目标。

## 十一、最自然的下一份规划文档

如果还继续只写规划，不落代码，那么下一份最自然的是：

1. 首批读接口联调切换计划。
2. 掠夺订单与异步结算专项设计。
3. Prisma seed 与初始静态数据装载计划。

如果目标仍然是优先服务 AI 实操，我最建议下一份先写第 1 个。因为 migration 批次定下来后，接下来最容易让 AI 和前端配合顺畅的，就是明确哪些读接口先切真实库、哪些继续保留 mock 回退、切换验收点是什么。