# TrinityWar 首批数据库表与 Prisma Schema 草案 v0.1

## 一、文档目的

这份文档是给 AI 和开发执行用的 Prisma schema 规划文档。

它不直接替代最终的 schema.prisma，但它要先解决四个问题：

1. 第一批数据库表到底有哪些。
2. 每张表应该保存什么，不应该保存什么。
3. 哪些字段要先做，哪些字段可以后补。
4. Prisma migration 应该分几步落，才能降低返工风险。

这份文档默认服务端技术栈为：

1. Node.js
2. TypeScript
3. NestJS
4. Prisma
5. PostgreSQL
6. Redis
7. BullMQ

## 二、当前 schema 设计原则

所有 schema 设计都必须遵守下面这些原则。

### 1. 先按规则拆，不按页面拆

数据库不是为页面服务的，而是为规则和结算服务的。

因此：

1. 先看谁是核心实体。
2. 先看哪些动作会改状态。
3. 先看哪些结果必须可追溯。
4. 最后才考虑某个页面要不要多查一个字段。

### 2. 玩家当前状态和行为日志分开

不要把“当前状态”和“发生过什么”混在一张表里。

因此：

1. player_wallet、player_building、player_field_slot 这类表负责保存当前状态。
2. wallet_change_log、building_upgrade_log、field_harvest_log 这类表负责保存历史行为。

### 3. 所有关键状态都要能支撑并发控制

凡是会被多个请求争抢的东西，都必须有版本边界或时间边界。

典型例子：

1. 钱包资产。
2. 农场地块状态。
3. 兵力数量。
4. 掠夺订单。
5. 任务领取。

因此这些表一般都应该有：

1. updatedAt
2. version 或等价状态版本字段
3. requestIdempotencyKey 这类幂等定位字段在日志或订单表中留口

### 4. 第一版 schema 先求稳，再求全

第一版不要试图把未来三个月的内容一次设计完。

第一版必须优先覆盖：

1. 当前 Web 验证前端已经有的六大核心模块。
2. 当前服务端已存在的主要读写链路。
3. 当前最容易出错的资金、收取、升级、掠夺、分红、任务逻辑。

## 三、首批 schema 落地范围

第一批 Prisma schema 必须覆盖以下模块：

1. 玩家身份与建档。
2. 钱包与待领取收益。
3. 建筑与主城扩展。
4. 农场地块与种子库存。
5. 部队/灵宠与训练队列。
6. 每日任务状态。
7. 阵营与贡献。
8. 掠夺目标、掠夺订单、战报。
9. 审计日志。

第一批可以暂缓完整化的模块：

1. 完整赛季系统。
2. 完整排行榜历史归档。
3. 复杂好友与社交系统。
4. 完整商业化订单系统。
5. 完整 GM 权限体系。

## 四、推荐 Prisma 顶层结构

建议最终 schema 按下面逻辑组织：

1. datasource db
2. generator client
3. enums
4. 核心模型
5. 日志模型
6. 后台与任务模型

建议先统一几个命名约定：

1. Prisma model 用 PascalCase，例如 Player、PlayerWallet。
2. 数据库表名统一 snake_case，用 @@map 映射，例如 @@map("player_wallet")。
3. 字段名用 camelCase，数据库列名需要 snake_case 时用 @map。
4. 主键 id 一律先用 String + cuid() 或 uuid。
5. 需要唯一约束的组合，用 @@unique。
6. 高频过滤和排序字段，显式建 @@index。

## 五、推荐首批枚举

下面这些枚举应该在第一版 schema 中先定义。

### 1. AuthProvider

用途：身份来源。

建议值：

1. WECHAT
2. DEV_FAKE

### 2. FieldStatus

用途：农场地块状态。

建议值：

1. LOCKED
2. EMPTY
3. SEEDED
4. GROWING
5. MATURE
6. WITHERED

说明：

1. 现有前端展示口径是 seeded、growing、mature、withered、empty、locked。
2. Prisma 枚举建议统一大写，服务层负责映射。

### 3. RaidOrderStatus

用途：掠夺订单状态。

建议值：

1. PENDING
2. SETTLING
3. SETTLED
4. FAILED
5. CANCELLED

### 4. BattleResult

用途：战斗结果摘要。

建议值：

1. WIN
2. LOSE
3. DRAW

### 5. TaskStatus

用途：每日任务状态。

建议值：

1. IN_PROGRESS
2. COMPLETED
3. CLAIMED

### 6. WalletChangeType

用途：资产流水类型。

建议值最少要有：

1. BUILDING_UPGRADE
2. CULTIVATION_START
3. FIELD_HARVEST
4. RAID_LOOT_DEPOSIT
5. RAID_OVERFLOW_PENDING
6. TAX_CLAIM
7. FACTION_DIVIDEND_CLAIM
8. TASK_REWARD_CLAIM
9. ARMY_RECRUIT
10. FACTION_DONATE
11. ADMIN_ADJUSTMENT

### 7. WalletBucket

用途：资产桶归属。

建议值：

1. VAULT
2. WALLET
3. PENDING_TAX
4. PENDING_DIVIDEND
5. PENDING_RAID_OVERFLOW
6. FACTION_TREASURY

### 8. JobStatus

用途：系统任务状态。

建议值：

1. QUEUED
2. RUNNING
3. SUCCEEDED
4. FAILED
5. CANCELLED

## 六、核心模型草案

下面不是最终 Prisma 代码，而是模型级别的字段草案。

## 1. Player

### 用途

1. 玩家基础身份。
2. 当前阵营归属。
3. 进入其他主状态表的聚合根。

### 建议字段

1. id
2. nickname
3. avatarUrl
4. factionId
5. castleLevelCache
6. lastLoginAt
7. createdAt
8. updatedAt
9. stateVersion

### 字段说明

1. factionId 允许首版为空，适配未选阵营阶段。
2. castleLevelCache 是摘要字段，正式来源仍是 PlayerBuilding.castleLevel。
3. stateVersion 用于聚合级乐观锁和缓存失效。

### 关系

1. 一个 Player 对应一个 PlayerWallet。
2. 一个 Player 对应一个 PlayerBuilding。
3. 一个 Player 对应一个 PlayerArmy。
4. 一个 Player 对应多个 PlayerFieldSlot。
5. 一个 Player 对应多个 PlayerSeedInventory。
6. 一个 Player 对应多个 PlayerDailyTaskState。
7. 一个 Player 对应多个 BattleReport。

### 索引建议

1. @@index([factionId])
2. @@index([lastLoginAt])

## 2. PlayerAuthIdentity

### 用途

1. 绑定外部身份提供方。
2. 支撑微信 openid 登录。
3. 支撑开发环境假登录。

### 建议字段

1. id
2. playerId
3. provider
4. providerUserId
5. unionId
6. createdAt
7. updatedAt

### 约束

1. provider + providerUserId 必须唯一。
2. 一个 player 可以未来绑定多个身份来源。

### 索引建议

1. @@unique([provider, providerUserId])
2. @@index([playerId])

## 3. Faction

### 用途

1. 阵营基础信息。
2. 阵营公库状态。
3. 阵营贡献和分红的聚合根。

### 建议字段

1. id
2. code
3. name
4. treasuryGold
5. hourlyBaseDividend
6. hourlyContributionDividendPerTen
7. contributionScore
8. createdAt
9. updatedAt

### 说明

1. hourlyBaseDividend 和贡献分红系数建议显式存储，避免前期所有内容都从配置反推。
2. contributionScore 是阵营级总贡献摘要，不等于单玩家贡献。

### 约束

1. code 唯一。
2. name 唯一。

## 4. FactionMember

### 用途

1. 保存玩家在阵营中的成员关系。
2. 保存个人贡献状态。

### 建议字段

1. id
2. factionId
3. playerId
4. contributionScore
5. joinedAt
6. updatedAt

### 约束

1. 同一个 player 在同一时刻只能有一条有效成员关系。
2. 首版可先直接做 factionId + playerId 唯一。

### 索引建议

1. @@unique([factionId, playerId])
2. @@index([playerId])

## 5. PlayerWallet

### 用途

1. 保存个人资产当前状态。
2. 支撑首页资源条和领取逻辑。

### 建议字段

1. playerId
2. vaultGold
3. vaultCapacity
4. walletGold
5. walletCapacity
6. walletProtectedRatio
7. pendingTaxGold
8. pendingDividendGold
9. pendingRaidOverflowGold
10. pendingRaidOverflowExpiresAt
11. updatedAt
12. balanceVersion

### 说明

1. 现在前端已有 tax、faction、raid-overflow 三类待领取来源，所以建议先拆成三列，不要合并为一个 pendingIncomeJson。
2. pendingRaidOverflowExpiresAt 直接服务当前待领取掠夺溢出 5 分钟规则。
3. walletCapacity 如果首版暂时不用，也建议先保留字段，避免以后再拆表。

### 约束

1. playerId 唯一。
2. 金额字段一律 non-negative。

### 索引建议

1. @@index([pendingRaidOverflowExpiresAt])

## 6. PlayerBuilding

### 用途

1. 保存主城与建筑等级。
2. 保存主城扩展线等级。

### 建议字段

1. playerId
2. castleLevel
3. vaultLevel
4. fieldSlotLevel
5. populationLevel
6. watchtowerLevel
7. protectionTechLevel
8. farmYieldTechLevel
9. ripeWindowTechLevel
10. pendingClaimTechLevel
11. updatedAt
12. buildingVersion

### 说明

1. 当前 Web 端已有主城、金库、灵宠上限、防守建筑和四条扩展线，所以第一版直接列展开最稳。
2. 不建议第一版就做 JSON 建筑树，否则 AI 后续很容易把规则校验写乱。

### 约束

1. playerId 唯一。
2. 所有等级初值至少为 1 或 0，具体按规则定，但不要允许 null。

## 7. PlayerArmy

### 用途

1. 保存兵力/灵宠当前数量和冻结状态。
2. 支撑训练、掠夺派遣、容量检查。

### 建议字段

1. playerId
2. totalCount
3. availableCount
4. frozenCount
5. woundedCount
6. capacity
7. updatedAt
8. armyVersion

### 说明

1. capacity 可以冗余缓存自 PlayerBuilding.populationLevel 推导出的结果，便于直接查首页。
2. availableCount 不一定必须落库，但第一版落库可以减少高频现算复杂度。

### 约束

1. totalCount >= availableCount + frozenCount + woundedCount
2. playerId 唯一

## 8. ArmyTrainingQueue

### 用途

1. 保存单训练队列状态。
2. 支撑训练完成定时结算。

### 建议字段

1. id
2. playerId
3. queuedCount
4. unitCostGold
5. totalCostGold
6. startedAt
7. finishAt
8. status
9. createdAt
10. updatedAt

### 说明

1. 当前 demo 是单训练队列，所以首版不必做多队列。
2. status 建议先用 String 或单独枚举，例如 QUEUED、FINISHED、CLAIMED、CANCELLED。

### 约束

1. 同一玩家同一时刻最多一条有效中的训练队列。

### 索引建议

1. @@index([playerId, status])
2. @@index([finishAt])

## 9. SeedDefinition

### 用途

1. 保存种子静态定义。
2. 为图鉴、播种、收益计算提供数据源。

### 建议字段

1. id
2. seedId
3. label
4. rarity
5. seedSeconds
6. growSeconds
7. matureSeconds
8. ripeWindowSeconds
9. baseYieldGold
10. harvestSeedReturn
11. strategyNote
12. lore
13. createdAt
14. updatedAt

### 说明

1. 静态定义表建议独立，避免所有规则硬编码在代码里。
2. 现有 game-balance.js 中的种子数据后续应逐步迁到这里或配置中心。

### 约束

1. seedId 唯一。

## 10. PlayerSeedInventory

### 用途

1. 保存玩家已有种子库存。
2. 保存是否解锁过某个种子。

### 建议字段

1. id
2. playerId
3. seedDefinitionId
4. quantity
5. unlockedAt
6. createdAt
7. updatedAt

### 约束

1. playerId + seedDefinitionId 唯一。

## 11. PlayerFieldSlot

### 用途

1. 保存单块田当前状态。
2. 支撑播种、成熟、丰熟、过熟、被掠、收取。

### 建议字段

1. id
2. playerId
3. slotIndex
4. isUnlocked
5. unlockCastleLevel
6. status
7. seedDefinitionId
8. investedGold
9. currentClaimableGold
10. harvestedGoldTotal
11. raidedGoldTotal
12. seedAt
13. matureAt
14. fullMatureAt
15. overripeAt
16. lastCalculatedAt
17. statusVersion
18. createdAt
19. updatedAt

### 说明

1. isUnlocked + unlockCastleLevel 同时存在，便于后台排查和客户端读取。
2. lastCalculatedAt 用于未来做惰性结算或阶段刷新。
3. currentClaimableGold 是当前可收值，不必每次从全部历史现算。

### 约束

1. playerId + slotIndex 唯一。

### 索引建议

1. @@index([playerId, status])
2. @@index([matureAt])
3. @@index([fullMatureAt])
4. @@index([overripeAt])

## 12. PlayerDailyTaskState

### 用途

1. 保存每日任务的当日进度与领取状态。

### 建议字段

1. id
2. playerId
3. dateKey
4. taskId
5. progress
6. target
7. status
8. rewardGold
9. actionScene
10. updatedAt
11. claimedAt

### 约束

1. playerId + dateKey + taskId 唯一。

### 索引建议

1. @@index([playerId, dateKey])
2. @@index([dateKey, status])

## 13. RaidTargetPool

### 用途

1. 保存当前可刷新的掠夺目标池。
2. 支撑列表读取与刷新机制。

### 建议字段

1. id
2. ownerPlayerId
3. targetPlayerId
4. slotIndex
5. targetSnapshotJson
6. fieldSnapshotJson
7. riskSnapshotJson
8. refreshBatchNo
9. expiresAt
10. createdAt
11. updatedAt

### 说明

1. 目标池是“给谁看的目标池”，不是全局目标表，所以建议 ownerPlayerId 表示列表所属玩家。
2. targetSnapshotJson 是允许的，因为目标池本身就是展示快照层，不是核心状态源。

### 约束

1. ownerPlayerId + targetPlayerId + slotIndex + refreshBatchNo 可以视情况唯一。

### 索引建议

1. @@index([ownerPlayerId, expiresAt])
2. @@index([ownerPlayerId, refreshBatchNo])

## 14. RaidOrder

### 用途

1. 保存发起后待结算或已结算的掠夺订单。

### 建议字段

1. id
2. attackerPlayerId
3. defenderPlayerId
4. defenderFieldSlotId
5. sourceTargetPoolId
6. mode
7. status
8. dispatchedUnitCount
9. frozenUnitSnapshot
10. transportCapacitySnapshot
11. attackerSnapshotJson
12. defenderSnapshotJson
13. dispatchedAt
14. settleAt
15. settledAt
16. requestIdempotencyKey
17. settlementVersion
18. createdAt
19. updatedAt

### 说明

1. requestIdempotencyKey 必须有，用于防止重复发起。
2. attacker/defender snapshot 可以先用 Json，首版目标是可结算、可回放、可排错。

### 约束

1. requestIdempotencyKey 唯一。

### 索引建议

1. @@index([attackerPlayerId, status])
2. @@index([defenderPlayerId, status])
3. @@index([settleAt, status])

## 15. RaidSettlement

### 用途

1. 保存掠夺结算的结构化结果。

### 建议字段

1. id
2. raidOrderId
3. result
4. lootGold
5. depositedGold
6. overflowGold
7. temporaryClaimExpiresAt
8. attackerLoss
9. defenderLoss
10. rewardItemsJson
11. reportSummary
12. createdAt

### 说明

1. 即使有 battle_report，也建议结算结果单独存，方便后台查账。
2. rewardItemsJson 首版可先 Json，后续如要做可查询掉落统计再拆表。

### 约束

1. raidOrderId 唯一。

## 16. BattleReport

### 用途

1. 支撑前端战报页。
2. 支撑后台查询。

### 建议字段

1. id
2. raidOrderId
3. ownerPlayerId
4. opponentPlayerId
5. reportType
6. result
7. title
8. summary
9. revengeAvailable
10. revokedAt
11. createdAt

### 说明

1. 同一场掠夺通常会给双方各一条 report，所以 battle_report 不建议只按 raidOrder 唯一。
2. ownerPlayerId 表示“这条战报属于谁看”。

### 索引建议

1. @@index([ownerPlayerId, createdAt])
2. @@index([raidOrderId])

## 七、审计与日志模型草案

## 1. WalletChangeLog

### 用途

1. 记录所有关键资产变动。

### 建议字段

1. id
2. playerId
3. walletBucket
4. changeType
5. deltaGold
6. beforeGold
7. afterGold
8. relatedEntityType
9. relatedEntityId
10. requestIdempotencyKey
11. note
12. createdAt

### 索引建议

1. @@index([playerId, createdAt])
2. @@index([requestIdempotencyKey])
3. @@index([changeType, createdAt])

## 2. BuildingUpgradeLog

### 建议字段

1. id
2. playerId
3. buildingKey
4. oldLevel
5. newLevel
6. costGold
7. requestIdempotencyKey
8. createdAt

## 3. FieldHarvestLog

### 建议字段

1. id
2. playerId
3. fieldSlotId
4. collectMode
5. collectedGold
6. overflowGold
7. rewardItemsJson
8. createdAt

## 4. FactionContributionLog

### 建议字段

1. id
2. factionId
3. playerId
4. donatedGold
5. contributionDelta
6. createdAt

## 5. FactionDividendLog

### 建议字段

1. id
2. factionId
3. playerId
4. baseDividendGold
5. contributionBonusGold
6. totalDividendGold
7. settledAt
8. claimedAt
9. createdAt

## 6. AdminAdjustmentLog

### 建议字段

1. id
2. adminUserId
3. targetPlayerId
4. adjustmentType
5. fieldKey
6. beforeValue
7. afterValue
8. reason
9. createdAt

## 7. SystemJobLog

### 建议字段

1. id
2. jobName
3. jobKey
4. status
5. payloadJson
6. startedAt
7. finishedAt
8. errorMessage
9. retryCount
10. createdAt

## 八、首批 migration 拆分建议

Prisma migration 不要一次把所有表全上，否则返工成本高。

### Migration 001：基础身份与阵营

包含：

1. Player
2. PlayerAuthIdentity
3. Faction
4. FactionMember

目标：

1. 先跑通登录与建档。
2. 先建立玩家和阵营基础关系。

### Migration 002：玩家主状态

包含：

1. PlayerWallet
2. PlayerBuilding
3. PlayerArmy
4. ArmyTrainingQueue
5. SeedDefinition
6. PlayerSeedInventory
7. PlayerFieldSlot
8. PlayerDailyTaskState

目标：

1. 把首页、建筑、农场、部队、任务的当前状态搬进数据库。

### Migration 003：掠夺与战报

包含：

1. RaidTargetPool
2. RaidOrder
3. RaidSettlement
4. BattleReport

目标：

1. 把掠夺主循环搬进数据库。

### Migration 004：审计与阵营流水

包含：

1. WalletChangeLog
2. BuildingUpgradeLog
3. FieldHarvestLog
3. FactionContributionLog
4. FactionDividendLog
5. AdminAdjustmentLog
6. SystemJobLog

目标：

1. 让后台和排错能力可用。
2. 让异步任务有日志可查。

## 九、Prisma 代码生成注意点

### 1. Decimal 还是 Int

首版建议金币、贡献、兵力相关数值一律用 Int。

原因：

1. 当前设计没有强需求使用小数金币。
2. Int 对 AI 和业务代码更稳定。
3. 减少 Decimal 在 TypeScript 中的转换心智负担。

### 2. Json 字段使用边界

Json 字段只允许先用于这些地方：

1. 目标池快照。
2. 掠夺结算奖励列表。
3. 订单中的快照信息。
4. 任务 payload 或 job payload。

不要把玩家主状态放进 Json。

### 3. createdAt / updatedAt 统一策略

所有主状态和日志表都建议有 createdAt。

所有会被修改的主状态表都建议有 updatedAt。

Prisma 推荐写法：

1. createdAt DateTime @default(now())
2. updatedAt DateTime @updatedAt

### 4. 关系命名统一

如果一个表对 Player 有两个关系，例如 BattleReport 里 ownerPlayerId 和 opponentPlayerId，必须显式命名 relation，避免 Prisma 生成冲突。

### 5. 映射旧 DTO 时不要硬凑字段名

数据库字段应该首先服务规则与数据结构，不要只为了某个前端字段名强行命名。

应在 service 层做 DTO 映射。

## 十、AI 执行顺序建议

AI 生成 schema 时，按下面顺序推进最稳：

1. 先写 enums。
2. 再写 Player、Faction、PlayerAuthIdentity、FactionMember。
3. 再写 PlayerWallet、PlayerBuilding、PlayerArmy。
4. 再写 SeedDefinition、PlayerSeedInventory、PlayerFieldSlot、PlayerDailyTaskState。
5. 再写 RaidTargetPool、RaidOrder、RaidSettlement、BattleReport。
6. 最后写各类日志表。

每完成一批，都要先做：

1. prisma format
2. prisma validate
3. migration dev
4. 读一遍生成后的 SQL 是否符合预期

## 十一、AI 任务模板

### 1. 生成首批基础模型

你现在只负责生成 Prisma schema 的第一批基础模型：Player、PlayerAuthIdentity、Faction、FactionMember，以及需要的枚举。不要生成 controller、service、DTO。要求：1. 使用 PostgreSQL；2. 表名用 snake_case 映射；3. 所有关联显式命名；4. 给出 migration 风险点。

### 2. 生成玩家主状态模型

你现在只负责生成 PlayerWallet、PlayerBuilding、PlayerArmy、ArmyTrainingQueue、SeedDefinition、PlayerSeedInventory、PlayerFieldSlot、PlayerDailyTaskState 的 Prisma 模型。不要扩展到掠夺系统。要求：1. 不使用大而全的 Json 字段代替主状态；2. 所有关键状态表带 updatedAt 和版本字段；3. 给出建议索引。

### 3. 生成掠夺与战报模型

你现在只负责生成 RaidTargetPool、RaidOrder、RaidSettlement、BattleReport 以及必要的枚举。要求：1. 明确订单、结算、战报三者边界；2. 订单要支持幂等键；3. 战报支持 ownerPlayerId 维度查询；4. 快照允许使用 Json，但主状态来源不能是 Json。

### 4. 生成日志模型

你现在只负责生成 WalletChangeLog、BuildingUpgradeLog、FieldHarvestLog、FactionContributionLog、FactionDividendLog、AdminAdjustmentLog、SystemJobLog。要求：1. 所有日志必须能按玩家和时间查询；2. 资产变动日志必须包含前值后值；3. 后台修正日志必须包含原因。

## 十二、验收标准

当这份 schema 草案进入执行阶段后，至少要满足下面这些验收项：

1. Prisma schema 可 validate 通过。
2. migration 可以分批执行。
3. 表边界清晰，没有把主状态塞进 Json。
4. 关键资产和地块状态表具备版本或时间边界。
5. 掠夺订单、结算、战报三张表边界清晰。
6. 后台与审计日志最小可查。
7. 能直接支撑下一步 repository/service 开发，而不需要重新推翻 schema。

## 十三、下一步文档建议

当这份文档确认后，下一步最适合继续产出两份文件：

1. 首批 repository / service 设计文档。
2. 首批真实接口契约清单。

顺序不要反过来。

因为 schema 没定之前，接口契约和 service 职责很容易反复漂移。
