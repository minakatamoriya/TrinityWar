# TrinityWar 首批写链路事务与幂等策略清单 v0.1

## 一、文档目的

这份文档是给 AI 和开发执行用的首批命令链路专项规划。

前面的几份文档已经分别回答了：

1. 整体后端怎么分阶段推进。
2. 数据模型大概长什么样。
3. 接口契约有哪些。
4. service 分层怎么做。
5. 模块骨架怎么拆。

但真正到了开始写命令链路时，AI 最容易写错的不是 controller 目录，而是下面这些细节：

1. 哪一步必须放进同一个事务。
2. 哪一步必须在事务外执行。
3. 哪些版本号需要校验。
4. 幂等键到底拦哪一层。
5. 什么情况下应该返回旧结果，什么情况下应该报冲突。
6. 哪些日志必须和主写入一起成功，哪些日志可以异步补。

这份文档的目标就是把这些关键点写清楚，方便后续 AI 逐条命令照着落地，而不是边写边猜。

本文件与以下文档配套使用：

1. 总计划：[dev/ai-backend-master-plan.md](dev/ai-backend-master-plan.md)
2. 接口契约：[dev/ai-backend-api-contract-plan.md](dev/ai-backend-api-contract-plan.md)
3. Service 分层：[dev/ai-backend-service-plan.md](dev/ai-backend-service-plan.md)
4. 模块骨架：[dev/ai-backend-module-skeleton-plan.md](dev/ai-backend-module-skeleton-plan.md)

## 二、先统一 6 条总规则

### 1. 事务由 use case 控制，不由 repository 控制

任何会改玩家核心状态的命令链路，都必须由 use case 明确开启事务，并在同一个事务上下文内调用多个 repository。

### 2. 审计日志优先跟主写入同事务

以下日志优先跟主事务一起提交：

1. WalletChangeLog
2. BuildingUpgradeLog
3. FieldHarvestLog
4. FactionContributionLog
5. RaidOrder
6. RaidSettlement
7. BattleReport
8. TaskRewardLog

因为这些不是“可有可无”的业务日志，而是正式结算的一部分。

### 3. 聚合读取响应放事务后

`home-summary` 和 `scene-content` 的刷新聚合，应在事务提交后读取。

不要在事务里顺手再查一大堆页面聚合数据，否则事务时间会被拉长。

### 4. 幂等分成两类

第一类：业务唯一幂等

例如：

1. 同一条每日任务奖励只能领一次。
2. 同一个 starter reward 只能领一次。
3. 同一个 raid order 不能重复结算。

第二类：请求幂等

例如：

1. 同一个 `X-Idempotency-Key` 重放请求，不应该重复扣钱。
2. 网络超时后客户端重试，应该得到同一结果或明确冲突结果。

正式实现时，两类幂等都要有，不能只做 header 幂等。

### 5. 版本校验只校验会发生竞争写入的状态

首批推荐使用的版本号：

1. `walletVersion`
2. `buildingVersion`
3. `fieldVersion`
4. `armyVersion`
5. `seedInventoryVersion`

不是所有接口都必须把所有版本号都带上，而是按命令实际会碰到的状态来校验。

### 6. 外部副作用默认不放主事务

下面这些动作默认不进入主事务：

1. 推送通知
2. MQ 广播
3. 非关键埋点
4. 非关键调试日志

原则是：

1. 核心数据和审计日志先落稳。
2. 外围副作用失败不能影响主结算提交。

## 三、统一命令执行模板

所有首批写链路，建议统一遵守下面顺序：

1. Controller 收到请求。
2. DTO 校验参数格式。
3. 读取当前 playerId。
4. 校验 `X-Idempotency-Key` 是否存在。
5. 进入 use case。
6. 先做事务外快速预检查。
7. 开启事务。
8. 在事务内重新读取关键状态。
9. 校验版本号。
10. 执行业务规则判断。
11. 执行主状态写入。
12. 写审计日志。
13. 写幂等结果记录或将幂等记录标为 completed。
14. 提交事务。
15. 事务后读取刷新响应。
16. 返回结果。

### 事务外快速预检查包含什么

允许做：

1. 参数基础合法性。
2. 当前玩家身份存在性。
3. 幂等键格式校验。
4. 极轻量的只读预检查。

不要做：

1. 依赖预检查结果直接决定最终成功。
2. 在事务外先扣钱。
3. 在事务外先改状态。

最终决定必须以事务内二次读取为准。

## 四、统一幂等记录建议

建议建立统一的 `idempotency_record` 或等价结构。

### 建议字段

1. id
2. playerId
3. endpointKey
4. idempotencyKey
5. requestHash
6. status
7. responseSnapshotJson
8. businessEntityType
9. businessEntityId
10. createdAt
11. updatedAt
11. expiresAt

### 唯一约束建议

1. `playerId + endpointKey + idempotencyKey` 唯一

### 状态建议

1. `processing`
2. `completed`
3. `failed`

### 使用规则

1. 首次请求写入 `processing`。
2. 成功提交事务后写入 `completed` 和响应快照。
3. 相同 key 再次请求时：
   如果 requestHash 相同且状态为 completed，可直接返回快照。
4. 相同 key 但 requestHash 不同，应返回冲突错误，不允许共用一个 key 携带不同请求体。
5. 如果发现状态长期卡在 processing，必须有过期与补偿策略。

## 五、统一版本校验建议

### 1. 版本校验目标

版本校验不是为了替代数据库事务，而是为了让前端和后端更快发现“你操作时看到的是旧状态”。

### 2. 统一错误码

版本冲突统一优先使用：

1. `STATE_VERSION_CONFLICT`

局部也允许更细错误码，但前端第一版最好先统一收口。

### 3. 推荐策略

如果请求里带了版本号：

1. 事务内读取当前版本。
2. 不一致则直接报冲突。

如果请求里暂时没带版本号：

1. 仍依赖事务内状态判断。
2. 但不建议长期缺失。

### 4. 不要误用版本号

不要把版本号当成幂等键。

版本号解决的是：

1. 你操作时基于的状态是否过期。

幂等键解决的是：

1. 同一个请求是否被重复提交。

## 六、统一日志落点建议

### 1. 必须事务内写的日志

1. 资产变化日志。
2. 建筑升级日志。
3. 收菜日志。
4. 训练队列创建日志。
5. 任务奖励领取日志。
6. 阵营贡献变化日志。
7. 掠夺订单与结算日志。

### 2. 可事务后写的日志

1. 成功 info log
2. trace log
3. debug 观测日志

### 3. 错误日志建议

1. 业务失败由业务异常统一表达。
2. controller filter 或 use case 边界集中记 error log。
3. repository 不要各自重复打一遍 error log。

## 七、首批命令链路逐条策略

下面是第一批命令链路的具体策略清单。

## 1. ClaimPendingGoldUseCase

对应接口：

1. `POST /api/client/actions/claim-pending`

### 事务内必须完成

1. 读取 wallet 当前状态。
2. 校验 `walletVersion`。
3. 读取指定 pending source 当前值。
4. 校验是否仍存在待领取金额。
5. 计算是否溢出。
6. 如果用户未确认溢出损失，则在需要时返回容量错误。
7. 更新 wallet 实际到账金额。
8. 清空对应 pending source。
9. 写 WalletChangeLog。
10. 写 idempotency 完成结果。

### 事务外执行

1. 读取最新 home-summary。
2. 读取最新 scene-content。

### 幂等策略

1. 必须支持请求幂等。
2. 同一个 source 在已成功领取后再次请求，应返回 `NO_PENDING_CLAIM` 或直接返回已完成快照，二选一后全局保持一致。
3. 更推荐：同 key 返回快照，不同 key 重复领返回 `NO_PENDING_CLAIM`。

### 版本校验

1. 校验 `walletVersion`。

### 审计日志

1. WalletChangeLog
2. 可选 PendingClaimLog

### 关键风险

1. 用户先看见可领取，随后另一端已领取。
2. 溢出确认前后 wallet 余额变化。

## 2. ClaimDailyTaskRewardUseCase

对应接口：

1. `POST /api/client/actions/claim-daily-task`

### 事务内必须完成

1. 读取任务状态。
2. 读取 wallet 状态。
3. 校验 `taskDateKey`。
4. 校验 `walletVersion`。
5. 校验任务存在、已完成、未领取。
6. 计算奖励到账与溢出。
7. 在允许情况下更新 wallet。
8. 标记任务已领取。
9. 写 TaskRewardLog。
10. 写 WalletChangeLog。
11. 写 idempotency 完成结果。

### 事务外执行

1. 刷新首页和场景聚合。

### 幂等策略

1. 请求幂等必须有。
2. 业务唯一幂等也必须有，因为任务本身只能领取一次。
3. 若相同请求重复提交，返回同一结果快照。

### 版本校验

1. `walletVersion`
2. 如任务表有版本字段，也可校验 `taskVersion`，但第一版不是硬要求。

### 审计日志

1. TaskRewardLog
2. WalletChangeLog

### 关键风险

1. 同一任务被双击重复领取。
2. 跨天刷新后旧任务 key 仍被领取。

## 3. ClaimStarterSeedsUseCase

对应接口：

1. `POST /api/client/actions/claim-starter-seeds`

### 事务内必须完成

1. 校验该奖励是否已领取。
2. 更新种子库存。
3. 标记奖励已领取。
4. 写奖励领取日志。
5. 写 idempotency 完成结果。

### 事务外执行

1. 刷新页面聚合。

### 幂等策略

1. 请求幂等需要。
2. 业务唯一幂等更关键，因为奖励天然只能领一次。

### 版本校验

1. 第一版可不强制版本号。
2. 如果后续引入 `seedInventoryVersion`，则可纳入。

### 审计日志

1. RewardClaimLog 或等价表
2. SeedInventoryChangeLog 可选

### 关键风险

1. 重复发放新手资源。

## 4. ClaimTianjiTalismanUseCase

对应接口：

1. `POST /api/client/actions/claim-tianji-talisman`

### 事务内必须完成

1. 校验今日是否已领取。
2. 更新物品或次数库存。
3. 标记今日领取状态。
4. 写奖励领取日志。
5. 写 idempotency 完成结果。

### 事务外执行

1. 刷新摘要响应。

### 幂等策略

1. 请求幂等需要。
2. 业务唯一幂等需要，因为同一天只能领一次。

### 版本校验

1. 第一版可不强制。

### 关键风险

1. 跨天边界重复领取。

## 5. StartCultivationUseCase

对应接口：

1. `POST /api/client/actions/start-cultivation`

### 事务内必须完成

1. 读取地块状态。
2. 读取种子库存。
3. 如涉及播种费用，读取 wallet。
4. 校验 `fieldVersion`。
5. 校验 `seedInventoryVersion`。
6. 如涉及费用，校验 `walletVersion`。
7. 校验地块已解锁且空闲。
8. 校验种子数量足够。
9. 扣减种子库存。
10. 如有费用则扣减 wallet。
11. 更新地块为种植中。
12. 写 SeedInventoryChangeLog。
13. 写 WalletChangeLog。
14. 写 FieldOperationLog。
15. 写 idempotency 完成结果。

### 事务外执行

1. 刷新首页和场景聚合。

### 幂等策略

1. 请求幂等需要。
2. 如果同 key 重试，应返回相同地块已进入种植中的结果快照。
3. 不同 key 对同一空地连续播种，应由 field 状态校验拦住，返回 `FIELD_NOT_EMPTY`。

### 版本校验

1. `fieldVersion`
2. `seedInventoryVersion`
3. `walletVersion` 视是否扣费而定

### 审计日志

1. SeedInventoryChangeLog
2. WalletChangeLog
3. FieldOperationLog

### 关键风险

1. 双击播种导致双扣种子。
2. 播种时另一端已收菜或已操作该地块。

## 6. CollectFieldUseCase

对应接口：

1. `POST /api/client/actions/collect-field`

### 事务内必须完成

1. 读取地块状态。
2. 读取 wallet 状态。
3. 校验 `fieldVersion`。
4. 校验 `walletVersion`。
5. 判断当前是否可收取。
6. 按 collectMode 计算奖励。
7. 判断金库容量与 overflow。
8. 在允许情况下更新 wallet。
9. 更新地块为收取后的合法状态。
10. 如有种子奖励则更新库存。
11. 推进相关任务进度。
12. 写 FieldHarvestLog。
13. 写 WalletChangeLog。
14. 写 TaskProgressLog 可选。
15. 写 idempotency 完成结果。

### 事务外执行

1. 刷新首页和场景聚合。

### 幂等策略

1. 请求幂等需要。
2. 同 key 重试返回同一收菜结果。
3. 不同 key 在已收取后再次请求，应返回 `FIELD_NOT_COLLECTABLE` 或 `FIELD_STATUS_CHANGED`。

### 版本校验

1. `fieldVersion`
2. `walletVersion`

### 审计日志

1. FieldHarvestLog
2. WalletChangeLog
3. SeedInventoryChangeLog 如有种子奖励

### 关键风险

1. 收菜成功后网络超时导致前端重试。
2. overflow 确认流程导致重复计算到账。

## 7. RecruitArmyUseCase

对应接口：

1. `POST /api/client/actions/recruit-army`

### 事务内必须完成

1. 读取 army 状态。
2. 读取 wallet 状态。
3. 校验 `armyVersion`。
4. 校验 `walletVersion`。
5. 校验当前无进行中的训练队列。
6. 校验训练数量和容量。
7. 计算总费用与完成时间。
8. 扣减 wallet。
9. 创建训练队列。
10. 更新 army 聚合状态。
11. 写 WalletChangeLog。
12. 写 ArmyTrainingQueueLog。
13. 写 idempotency 完成结果。

### 事务外执行

1. 刷新首页和场景聚合。
2. 如采用队列系统，可在事务提交后投递完成任务。

### 幂等策略

1. 请求幂等需要。
2. 同 key 重试返回同一训练队列结果。
3. 不同 key 重复提交时，应由“已存在训练队列”规则拦住。

### 版本校验

1. `armyVersion`
2. `walletVersion`

### 审计日志

1. WalletChangeLog
2. ArmyTrainingQueueLog

### 关键风险

1. 双击创建两条训练队列。
2. 训练任务入队失败但主事务已提交。

### 特别说明

任务入队应该在事务后做，但训练队列数据本身必须在事务里先落库。这样即使 job 投递瞬时失败，系统也能补投，而不会丢失真实训练状态。

## 8. DonateFactionGoldUseCase

对应接口：

1. `POST /api/client/actions/faction-donate`

### 事务内必须完成

1. 读取 wallet。
2. 读取 faction。
3. 读取 faction member。
4. 校验 `walletVersion`。
5. 校验上缴金额合法。
6. 校验 wallet 余额足够。
7. 扣减 wallet。
8. 增加 faction treasury。
9. 增加 member contribution。
10. 写 WalletChangeLog。
11. 写 FactionContributionLog。
12. 写 idempotency 完成结果。

### 事务外执行

1. 刷新首页和场景响应。

### 幂等策略

1. 请求幂等需要。
2. 同 key 重试返回同一上缴结果。
3. 不同 key 是允许再次上缴的，因此不能只靠业务唯一约束代替请求幂等。

### 版本校验

1. `walletVersion`

### 审计日志

1. WalletChangeLog
2. FactionContributionLog

### 关键风险

1. 重复扣款。
2. wallet 与 faction treasury 只改了一边。

## 9. UpgradeBuildingUseCase

对应接口：

1. `POST /api/client/actions/upgrade-building`

### 事务内必须完成

1. 读取 building 状态。
2. 读取 wallet 状态。
3. 校验 `buildingVersion`。
4. 校验 `walletVersion`。
5. 根据 targetType 定位实际升级目标。
6. 校验建筑未锁定、未满级。
7. 校验主城门槛。
8. 特别校验灵宠上限是否满足主城偶数级门槛。
9. 计算升级费用。
10. 扣减 wallet。
11. 更新 building 等级。
12. 如升级主城导致衍生摘要变更，同事务更新缓存摘要字段。
13. 写 WalletChangeLog。
14. 写 BuildingUpgradeLog。
15. 写 idempotency 完成结果。

### 事务外执行

1. 刷新首页和场景聚合。

### 幂等策略

1. 请求幂等需要。
2. 同 key 重试返回同一升级结果。
3. 不同 key 在同一等级已升完后再次请求，应按新状态重新判断，不应该误返回第一次结果。

### 版本校验

1. `buildingVersion`
2. `walletVersion`

### 审计日志

1. WalletChangeLog
2. BuildingUpgradeLog

### 关键风险

1. 双击升级重复扣钱。
2. 主城升级与扩展升级同时提交导致门槛错判。

## 10. RaidTargetUseCase

对应接口：

1. `POST /api/client/actions/raid-target`

### 事务内必须完成

1. 读取 army。
2. 读取 raid target pool 当前状态。
3. 读取保护期与复仇资格信息。
4. 校验 `armyVersion`。
5. 校验目标仍有效。
6. 校验自身兵力足够。
7. 创建 RaidOrder。
8. 冻结或占用兵力。
9. 如果首版采用即时结算：
   仍必须在同事务内写 RaidSettlement 与 BattleReport。
10. 如果会产生钱包变化：
   同事务写 WalletChangeLog。
11. 写 idempotency 完成结果。

### 事务外执行

1. 刷新首页和场景聚合。
2. 如采用异步结算，则事务后投递 settlement job。

### 幂等策略

1. 强制要求请求幂等。
2. 同 key 重试必须返回同一个 raid order 或同一个最终结果。
3. 不同 key 重新请求时，应基于最新 target/army/protection 状态重判，不能复用旧结果。

### 版本校验

1. `armyVersion`
2. 目标池如有版本字段也可校验，但第一版可选。

### 审计日志

1. RaidOrder
2. RaidSettlement
3. BattleReport
4. WalletChangeLog 如有资产变化

### 关键风险

1. 掠夺发起成功但兵力未冻结。
2. 订单创建成功但结算记录缺失。
3. 重试请求触发第二次掠夺。

### 特别说明

掠夺是第一批里最复杂的链路，建议再拆成两层：

1. 发起订单事务。
2. 订单结算事务。

即使首版做即时黑盒结算，代码结构上也应该保留这种分层，便于之后迁到异步结算。

## 八、首批不建议公开保留的命令

## 1. reset-demo-state

正式后端不应作为公开 client 命令保留。

### 处理建议

1. 迁移为 admin/debug 接口。
2. 仅本地与测试环境可用。
3. 必须有显式环境开关。
4. 不需要和正式命令共享幂等策略模板。

## 九、最推荐的实现优先级

如果后续开始让 AI 逐条落代码，建议优先按下面顺序实现：

1. UpgradeBuildingUseCase
2. ClaimPendingGoldUseCase
3. CollectFieldUseCase
4. StartCultivationUseCase
5. RecruitArmyUseCase
6. ClaimDailyTaskRewardUseCase
7. DonateFactionGoldUseCase
8. RaidTargetUseCase

原因：

1. building、wallet、field 这几条链路能最早验证事务与版本校验骨架是否稳。
2. raid 放最后，是因为它最复杂，也最容易让 AI 一次写乱。

## 十、AI 执行模板

### 1. 生成单条命令链路

你现在只负责生成 [动作名] 命令链路。必须严格遵循 [dev/ai-backend-command-transaction-idempotency-plan.md](dev/ai-backend-command-transaction-idempotency-plan.md) 中该动作的事务边界、幂等策略、版本校验点和日志落点。不要顺手实现其他命令。

### 2. 检查现有命令链路

你现在只负责检查 [动作名] 命令链路是否符合 [dev/ai-backend-command-transaction-idempotency-plan.md](dev/ai-backend-command-transaction-idempotency-plan.md)。请逐项核对：事务内操作、事务外操作、版本校验、幂等处理、审计日志、错误码和重试行为。

### 3. 补齐幂等与版本校验

你现在只负责给 [动作名] 命令链路补齐幂等与版本校验。不要重构无关目录，不要顺手改其他动作。

## 十一、验收清单

一条命令链路进入“可接受”状态前，至少要通过下面检查：

1. 是否明确了事务内步骤。
2. 是否明确了事务外步骤。
3. 是否说明了需要校验哪些版本号。
4. 是否同时覆盖请求幂等与业务唯一幂等。
5. 是否明确了重试时返回旧结果还是报错。
6. 是否明确了审计日志落点。
7. 是否说明了最可能出现的竞争条件。
8. 是否保证不会重复扣钱、重复发钱、重复发奖励。
9. 是否保证主写入和关键日志不会一边成功一边失败。
10. 是否能被 AI 按单条链路独立实现，而不依赖一次性大重构。

## 十二、最自然的下一份规划文档

如果还继续只写规划，不落代码，那么下一份最自然的是：

1. 首批数据库 migration 切分计划。
2. 首批读接口联调切换计划。
3. 掠夺订单与异步结算专项设计。

其中如果你想继续优先服务 AI 实操，最值得先写的是第 1 个。因为到真正落代码时，schema 和事务链路都已经相对清楚了，接下来最容易卡住 AI 的就是 migration 应该怎么分批，不然它容易一次生成过大、不可回滚的数据库改动。