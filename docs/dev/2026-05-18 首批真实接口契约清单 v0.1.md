# TrinityWar 首批真实接口契约清单 v0.1

## 一、文档目的

这份文档是给 AI 和开发执行用的首批真实接口契约清单。

它的作用不是替代 Swagger，而是先把下面这些关键问题定死：

1. 第一批必须保留哪些接口。
2. 第一批必须新增或调整哪些接口。
3. 每个接口的职责边界是什么。
4. 哪些接口是读接口，哪些是命令接口。
5. 哪些接口必须有幂等、版本校验、鉴权和错误码。
6. 前端从 mock 切到真实接口时，联调顺序应该怎样安排。

这份文档默认以当前项目现状为基础：

1. 已存在 `/api/client/bootstrap`。
2. 已存在 `/api/client/home-summary`。
3. 已存在 `/api/client/scene-content`。
4. 已存在一批 `/api/client/actions/*` 命令接口。
5. 共享 DTO 当前集中在 [packages/shared/src/index.ts](packages/shared/src/index.ts)。

## 二、接口设计总原则

### 1. 读接口和命令接口分开

不要把“读状态”和“修改状态”混成一个大接口。

因此：

1. 页面初始化、详情读取、列表读取属于读接口。
2. 升级、收取、训练、领取、掠夺、上缴属于命令接口。

### 2. 命令接口以动作命名，不追求过度 REST 化

对于当前阶段，围绕页面动作设计更稳。

例如：

1. `/actions/upgrade-building`
2. `/actions/collect-field`
3. `/actions/raid-target`

这比过早追求极度抽象的通用资源接口更适合 AI 和当前项目。

### 3. 任何影响资产和结算的命令接口都必须具备四样东西

1. 鉴权。
2. 参数校验。
3. 幂等控制。
4. 统一错误结构。

### 4. 响应优先服务当前联调效率

当前阶段不要求所有页面每次命令后都重新手动发多次读请求。

因此短期内建议：

1. 命令接口继续返回刷新后的 `home` + `scenes`，保持前端低成本联调。
2. 等后端和前端稳定后，再考虑局部收敛响应体，减少冗余。

### 5. 首批接口必须以后端为唯一结算源

前端可以做：

1. 预估提示。
2. 二次确认。
3. loading 和 toast。

前端不能做：

1. 自己决定最终金币余额。
2. 自己决定是否升级成功。
3. 自己决定掠夺结果。
4. 自己决定任务奖励是否到账。

## 三、推荐统一请求约定

### 1. 鉴权

首批建议统一使用：

1. `Authorization: Bearer <token>`

开发环境可保留：

1. 假登录接口换取 token。
2. 通过测试账号或开发身份注入 playerId。

### 2. 幂等键

所有关键命令接口建议支持：

1. 请求头 `X-Idempotency-Key`

优先要求支持幂等的接口：

1. 领取待领取收益。
2. 领取任务奖励。
3. 农场收取。
4. 开始训练。
5. 发起掠夺。
6. 升级建筑。
7. 阵营上缴。

### 3. 版本号

涉及高冲突状态的接口，建议 body 或 header 支持版本号。

例如：

1. `stateVersion`
2. `walletVersion`
3. `fieldVersion`
4. `armyVersion`

首批最值得加版本号的接口：

1. `collect-field`
2. `upgrade-building`
3. `recruit-army`
4. `raid-target`

### 4. 统一错误结构

建议首批统一错误结构：

```json
{
  "app": "TrinityWar",
  "error": {
    "code": "VAULT_CAPACITY_EXCEEDED",
    "message": "当前金库空间不足。",
    "details": {
      "overflowGold": 120,
      "vaultCapacity": 1000,
      "vaultGold": 920
    }
  }
}
```

最低要求：

1. `code`
2. `message`
3. `details` 可选

## 四、推荐统一错误码分组

### 1. 鉴权类

1. `AUTH_REQUIRED`
2. `AUTH_INVALID_TOKEN`
3. `AUTH_EXPIRED`
4. `PLAYER_NOT_FOUND`

### 2. 参数类

1. `INVALID_REQUEST`
2. `INVALID_TARGET_ID`
3. `INVALID_FIELD_ID`
4. `INVALID_TASK_ID`

### 3. 状态冲突类

1. `STATE_VERSION_CONFLICT`
2. `FIELD_STATUS_CHANGED`
3. `ARMY_STATE_CHANGED`
4. `BUILDING_STATE_CHANGED`
5. `RAID_TARGET_EXPIRED`

### 4. 资源不足类

1. `INSUFFICIENT_VAULT_GOLD`
2. `INSUFFICIENT_ARMY`
3. `INSUFFICIENT_SEED`
3. `VAULT_CAPACITY_EXCEEDED`

### 5. 规则限制类

1. `CASTLE_LEVEL_TOO_LOW`
2. `BUILDING_LOCKED`
3. `FIELD_LOCKED`
4. `FIELD_NOT_COLLECTABLE`
5. `TASK_NOT_COMPLETED`
6. `TASK_ALREADY_CLAIMED`
7. `PROTECTION_ACTIVE`
8. `RAID_NOT_ALLOWED`

### 6. 系统类

1. `IDEMPOTENCY_REPLAY`
2. `JOB_NOT_READY`
3. `INTERNAL_ERROR`
4. `DEPENDENCY_UNAVAILABLE`

## 五、首批读接口契约

## 1. GET /api/client/bootstrap

### 用途

1. 客户端启动时获取基础引导信息。
2. 获取服务时间。
3. 获取赛季信息。
4. 获取背包与全局物品的最小引导状态。

### 当前状态

已存在。

### 是否保留

保留。

### 鉴权

需要。

### 请求头

1. Authorization

### 响应体

沿用当前 `ClientBootstrapResponse`，短期内继续兼容。

### 后续建议补充

1. `playerId` 或可选调试用摘要。
2. `featureFlags`。
3. `serverRevision` 或资源版本号。

### 失败场景

1. 未登录。
2. token 失效。
3. 玩家不存在。

## 2. GET /api/client/home-summary

### 用途

1. 首页总览。
2. 顶部资源条。
3. 待领取收益。
4. 每日任务摘要。

### 当前状态

已存在。

### 是否保留

保留。

### 鉴权

需要。

### 当前 DTO

沿用 `HomeSummaryResponse`。

### 后续建议补充

1. 返回 `stateVersion`。
2. 返回 `walletVersion`。
3. 返回 `taskDateKey`。

### 失败场景

1. 玩家状态不存在。
2. 读聚合失败。

## 3. GET /api/client/scene-content

### 用途

1. 拉取六大核心页面当前内容。
2. 便于当前 Web 验证前端一次渲染。

### 当前状态

已存在。

### 是否保留

短期保留，中期可能拆细。

### 鉴权

需要。

### 当前 DTO

沿用 `ClientSceneContentResponse`。

### 中期演进建议

当真实后端稳定后，可以拆成：

1. `/scene/building`
2. `/scene/farm`
3. `/scene/army`
4. `/scene/raid`
5. `/scene/report`
6. `/scene/faction`

但第一阶段不要急着拆，否则联调成本会上升。

## 4. GET /api/client/raid-targets/:targetId

### 用途

1. 读取掠夺目标详情。
2. 读取田地预览和可掠收益。

### 当前状态

已存在。

### 是否保留

保留。

### 鉴权

需要。

### 路径参数

1. `targetId`

### 当前 DTO

沿用 `ClientRaidTargetDetailResponse`。

### 额外要求

1. 必须校验目标是否仍在当前玩家可见目标池中。
2. 必须校验是否已过期。

### 失败场景

1. `RAID_TARGET_EXPIRED`
2. `RAID_TARGET_NOT_FOUND`
3. `AUTH_REQUIRED`

## 六、首批命令接口契约

## 1. POST /api/client/actions/claim-pending

### 用途

1. 领取主城税收。
2. 领取阵营分红。
3. 领取掠夺溢出待领取收益。

### 当前状态

已存在。

### 是否保留

保留。

### 请求体

沿用 `ClientClaimPendingRequest`：

1. `source`
2. `acceptOverflowLoss?`

### 建议新增

1. `walletVersion?`

### 响应体

沿用 `ClientClaimPendingResponse`。

### 必须支持的规则

1. 金库空间不足时返回统一溢出信息。
2. 用户确认后才允许接受溢出损失。
3. 同一个待领取来源不能重复领取。

### 幂等

需要。

### 错误码建议

1. `INVALID_REQUEST`
2. `STATE_VERSION_CONFLICT`
3. `VAULT_CAPACITY_EXCEEDED`
4. `NO_PENDING_CLAIM`

## 2. POST /api/client/actions/claim-daily-task

### 用途

1. 领取一条每日任务奖励。

### 当前状态

已存在。

### 是否保留

保留。

### 请求体

沿用 `ClientClaimDailyTaskRequest`：

1. `taskId`
2. `acceptOverflowLoss?`

### 建议新增

1. `taskDateKey?`
2. `walletVersion?`

### 响应体

沿用 `ClientClaimDailyTaskResponse`。

### 必须支持的规则

1. 未完成不可领。
2. 已领取不可重复领。
3. 金库满时先返回溢出提示，再允许确认损失。

### 幂等

需要。

### 错误码建议

1. `TASK_NOT_FOUND`
2. `TASK_NOT_COMPLETED`
3. `TASK_ALREADY_CLAIMED`
4. `VAULT_CAPACITY_EXCEEDED`

## 3. POST /api/client/actions/claim-starter-seeds

### 用途

1. 领取新手种子包或每日首发种子包。

### 当前状态

已存在。

### 是否保留

保留，但后续可能并入礼包系统。

### 请求体

无。

### 响应体

当前沿用 `ClientStateMutationResponse`。

### 建议

后续可补 `result` 字段，显式返回新增哪些种子。

### 幂等

需要。

### 错误码建议

1. `REWARD_ALREADY_CLAIMED`
2. `INTERNAL_ERROR`

## 4. POST /api/client/actions/claim-tianji-talisman

### 用途

1. 领取每日天机符。

### 当前状态

已存在。

### 是否保留

保留。

### 幂等

需要。

### 后续建议

补 `result` 返回实际到账物品。

## 5. POST /api/client/actions/collect-field

### 用途

1. 收取农场收益。
2. 根据收取模式处理成熟或提前收取逻辑。

### 当前状态

已存在。

### 是否保留

保留。

### 请求体

沿用 `ClientCollectFieldRequest`：

1. `fieldId`
2. `collectMode`

### 建议新增

1. `fieldVersion?`
2. `walletVersion?`

### 响应体

沿用 `ClientCollectFieldResponse`。

### 必须支持的规则

1. 地块必须属于当前玩家。
2. 状态必须允许收取。
3. 要正确处理金币溢出。
4. 要正确返回种子奖励。
5. 收取后地块必须切回空闲或下一个合法状态。

### 幂等

需要。

### 错误码建议

1. `FIELD_NOT_FOUND`
2. `FIELD_LOCKED`
3. `FIELD_NOT_COLLECTABLE`
4. `FIELD_STATUS_CHANGED`
5. `VAULT_CAPACITY_EXCEEDED`

## 6. POST /api/client/actions/start-cultivation

### 用途

1. 在空闲地块播种。

### 当前状态

已存在。

### 是否保留

保留。

### 请求体

沿用 `ClientStartCultivationRequest`：

1. `fieldId`
2. `seedId`

### 建议新增

1. `fieldVersion?`
2. `seedInventoryVersion?`
3. `walletVersion?`

### 响应体

短期继续沿用 `ClientStateMutationResponse`。

### 中期建议

补 `result`：

1. 实际扣除种子数量
2. 实际扣除金币数量
3. 预计成熟时间

### 必须支持的规则

1. 地块必须已解锁。
2. 地块必须为空闲。
3. 种子库存必须足够。
4. 如果播种消耗金币，金库必须足够。

### 幂等

需要。

### 错误码建议

1. `FIELD_LOCKED`
2. `FIELD_NOT_EMPTY`
3. `INSUFFICIENT_SEED`
4. `INSUFFICIENT_VAULT_GOLD`

## 7. POST /api/client/actions/recruit-army

### 用途

1. 发起单训练队列。
2. 扣除金币并进入训练中状态。

### 当前状态

已存在。

### 是否保留

保留。

### 请求体

沿用 `ClientRecruitArmyRequest`：

1. `recruitCount`

### 建议新增

1. `armyVersion?`
2. `walletVersion?`

### 响应体

短期继续沿用 `ClientStateMutationResponse`。

### 中期建议

补 `result`：

1. queuedUnits
2. readyAt
3. totalCost

### 必须支持的规则

1. 训练数量不能超过容量。
2. 金库必须足够。
3. 单训练队列存在时不能重复开第二条。

### 幂等

需要。

### 错误码建议

1. `INSUFFICIENT_VAULT_GOLD`
2. `ARMY_CAPACITY_EXCEEDED`
3. `TRAINING_QUEUE_EXISTS`
4. `ARMY_STATE_CHANGED`

## 8. POST /api/client/actions/raid-target

### 用途

1. 发起掠夺或复仇。

### 当前状态

已存在。

### 是否保留

保留。

### 请求体

沿用 `ClientRaidActionRequest`：

1. `targetId`
2. `mode?`

### 建议新增

1. `armyVersion?`
2. `requestIdempotencyKey?` 如果不从 header 传

### 响应体

沿用 `ClientRaidActionResponse`。

### 必须支持的规则

1. 目标必须仍在可见目标池内。
2. 自身可用兵力必须足够。
3. 发起成功后必须冻结兵力或占用出征资源。
4. 如果采用即时黑盒结算，也必须留下订单与结算记录。
5. 如果采用延迟结算，则响应体应返回订单已创建与预估信息。

### 幂等

强制需要。

### 错误码建议

1. `RAID_TARGET_NOT_FOUND`
2. `RAID_TARGET_EXPIRED`
3. `PROTECTION_ACTIVE`
4. `INSUFFICIENT_ARMY`
5. `IDEMPOTENCY_REPLAY`
6. `STATE_VERSION_CONFLICT`

## 9. POST /api/client/actions/faction-donate

### 用途

1. 向阵营上缴金币。
2. 转换成个人贡献。

### 当前状态

已存在。

### 是否保留

保留。

### 请求体

沿用 `ClientFactionDonateRequest`：

1. `goldAmount`

### 建议新增

1. `walletVersion?`

### 响应体

短期继续沿用 `ClientStateMutationResponse`。

### 中期建议

补 `result`：

1. donatedGold
2. contributionDelta
3. factionTreasuryAfter

### 幂等

需要。

### 错误码建议

1. `INSUFFICIENT_VAULT_GOLD`
2. `INVALID_REQUEST`
3. `STATE_VERSION_CONFLICT`

## 10. POST /api/client/actions/upgrade-building

### 用途

1. 升级基础建筑。
2. 升级主城扩展分支。

### 当前状态

已存在。

### 是否保留

保留。

### 请求体

沿用 `ClientUpgradeBuildingRequest`：

1. `targetType`
2. `buildingId?`
3. `extensionId?`

### 建议新增

1. `buildingVersion?`
2. `walletVersion?`

### 响应体

沿用 `ClientStateMutationResponse`。

### 必须支持的规则

1. 金币必须足够。
2. 主城门槛必须满足。
3. 已满级或锁定时不能升级。
4. 灵宠上限要严格受主城偶数级门槛控制。
5. 主城扩展与基础建筑的升级日志要能区分。

### 幂等

需要。

### 错误码建议

1. `INSUFFICIENT_VAULT_GOLD`
2. `CASTLE_LEVEL_TOO_LOW`
3. `BUILDING_LOCKED`
4. `BUILDING_MAX_LEVEL`
5. `STATE_VERSION_CONFLICT`

## 11. POST /api/client/actions/reset-demo-state

### 用途

1. 当前仅供本地验证环境快速回到初始状态。

### 当前状态

已存在。

### 是否保留

正式后端不保留为公开 client 接口。

### 处理建议

1. 本地开发环境可转移为 admin/debug 接口。
2. 测试和线上环境默认关闭。

## 七、建议新增接口

下面这些接口在正式后端阶段建议新增，不一定要第一天就落地，但应进入计划。

## 1. POST /api/client/auth/login

### 用途

1. 微信 code 登录。
2. 建档或换取 token。

### 请求体建议

1. `code`
2. `platform`
3. `deviceInfo?`

### 响应体建议

1. accessToken
2. refreshToken 可选
3. player bootstrap 摘要

## 2. POST /api/client/auth/dev-login

### 用途

1. 本地开发假登录。
2. 测试账号快速切换。

### 说明

仅开发/测试环境开放。

## 3. GET /api/client/me

### 用途

1. 获取当前玩家最小身份摘要。
2. 用于鉴权成功后的客户端全局上下文。

## 4. GET /api/client/scene/:sceneKey

### 用途

1. 中期替代 `scene-content` 的全量聚合读取。
2. 按页面按需拉取。

### 说明

第一阶段可不启用，但建议先纳入契约设计。

## 5. GET /api/client/reports

### 用途

1. 战报分页读取。
2. 支持按 attack / defense 分类。

### 请求参数建议

1. `type`
2. `cursor` 或 `page`
3. `pageSize`

## 6. GET /api/client/faction/rankings

### 用途

1. 读取阵营排行榜。
2. 后续支持分页和赛季维度。

## 7. GET /api/client/admin/debug-state

### 用途

1. 本地或测试环境直接查看当前玩家聚合状态。

### 说明

只用于开发，不对正式客户端开放。

## 八、响应收敛建议

当前命令接口普遍返回：

1. `summary`
2. `home`
3. `scenes`

这种模式对当前联调非常友好，短期建议保留。

但中期如果要减轻响应体，可逐步收敛为：

1. `summary`
2. `result`
3. `refreshHints`

例如：

```json
{
  "app": "TrinityWar",
  "summary": "主城升级完成，当前已升至 Lv.6。",
  "result": {
    "buildingId": "castle",
    "oldLevel": 5,
    "newLevel": 6
  },
  "refreshHints": ["home-summary", "scene-building"]
}
```

但在真实后端未稳定前，不建议过早改这件事。

## 九、接口分阶段落地顺序

### 第 1 阶段：保留现有接口形状，先接真实数据库

目标：

1. 前端几乎不用大改。
2. 优先把服务端从内存态切为数据库态。

优先接口：

1. `/bootstrap`
2. `/home-summary`
3. `/scene-content`
4. `/actions/upgrade-building`
5. `/actions/start-cultivation`
6. `/actions/collect-field`
7. `/actions/recruit-army`
8. `/actions/claim-pending`
9. `/actions/claim-daily-task`
10. `/actions/faction-donate`

### 第 2 阶段：补强掠夺和战报

优先接口：

1. `/raid-targets/:targetId`
2. `/actions/raid-target`
3. `/reports`

### 第 3 阶段：拆细读接口与后台接口

优先接口：

1. `/scene/:sceneKey`
2. `/faction/rankings`
3. `/admin/*`

## 十、AI 执行模板

### 1. 读取接口模板

你现在只负责设计并实现 [接口名] 的读取契约。要求：1. 明确鉴权；2. 明确请求参数；3. 明确响应字段与 shared DTO 对应关系；4. 不扩散到无关模块；5. 如现有 DTO 不够，先给出最小扩展建议而不是大改全部响应结构。

### 2. 命令接口模板

你现在只负责设计并实现 [接口名] 的命令契约。必须说明：1. 请求 DTO；2. 幂等策略；3. 版本控制策略；4. 错误码；5. 成功后的返回结构；6. 最小联调步骤。任何涉及金币、升级、收取、掠夺、奖励的逻辑，都必须以后端结算为准。

### 3. 错误码模板

你现在只负责为 [接口名] 补齐错误码与错误场景。不要改业务代码，只输出：1. 场景说明；2. code；3. message；4. 可选 details 字段结构；5. 前端建议如何处理。

### 4. 迁移兼容模板

你现在只负责把现有 Fastify demo 接口平滑迁移到真实数据库版。要求：1. 尽量保持现有 DTO 不变；2. 前端最少改动；3. 写出兼容期策略；4. 标明哪些字段后续再拆。

## 十一、接口验收清单

每个接口进入“可用”状态前，至少检查下面这些问题：

1. 是否已鉴权。
2. 是否已做参数校验。
3. 是否已定义错误码。
4. 是否已定义幂等策略。
5. 是否已定义版本控制或说明为何不需要。
6. 是否已明确数据库写入点。
7. 是否已明确日志记录点。
8. 是否已能被前端联调。
9. 是否已考虑接口重试场景。
10. 是否已避免前端本地假成功。

## 十二、下一步文档建议

完成这份接口契约文档后，最适合继续补的下一份文档是：

1. repository / service 分层设计文档。

因为当 schema 和接口都定住后，AI 最容易在 service 边界上继续失控。

如果 service 分层也先定下来，后续生成 controller、service、repository、worker 的成功率会更高。
