# 机器人 player-sim-v1 勤奋玩家模拟接入记录 v0.1

日期：2026-06-07

## 目标

新增一个不分玩家画像的真实交互模拟场景。每个机器人都按“勤奋玩家”方式尽量把当前可做的事情做一遍，用来观察交互链路是否报错，以及自然卡点集中在哪里。

## 范围

- 新增 `player-sim-v1` 模式。
- 使用 9 个模拟玩家：
  - 人界 3 个
  - 仙界 3 个
  - 魔界 3 个
- 每个玩家执行同一组动作：
  - 好友关系准备
  - 收菜
  - 播种
  - 领取阵营俸禄
  - 练兵
  - 灵宠成长
  - 好友灵田助力
  - 环形掠夺
- 管理后台新增“勤奋模拟 1 轮”按钮。
- 新增接口：`POST /api/admin/robots/player-sim-v1`

## 设计取舍

- 不改动 `daily-3` 和 `social-3`，它们继续作为稳定回归测试。
- `player-sim-v1` 不按玩家类型分流，所有玩家都尝试完整动作清单。
- 初始化只补最低可玩状态，不在每轮强制重置成熟田或大额资源。
- 无事可做、资源不足、冷却未到等归为 `BLOCKED`，用于观察卡点。
- 真正异常才归为 `FAILED`。

## 验证结果

已通过构建：

```bash
npm run build --workspace @trinitywar/game-server
npm run build --workspace @trinitywar/game-admin
```

真实接口验证：

- `POST /api/admin/robots/player-sim-v1`
- run 状态：`ISSUE`
- 成功动作：55
- 硬错误：0
- 卡点：9

动作分组：

- `friend-link`：1 成功
- `claim-faction-stipend`：9 成功
- `recruit-army`：9 成功
- `upgrade-spirit`：9 成功
- `friend-field-assist`：9 成功
- `raid-target`：9 成功
- `start-cultivation`：9 成功
- `collect-field`：9 卡点

当前自然卡点：

- 9 个玩家都没有可收取的成熟或枯萎田地。
- 这是合理卡点：上一轮或历史运行已把成熟田收掉，当前田地进入培育阶段，不能立刻再收。

## 下一步

- 给 `player-sim-v1` 增加并发模式：
  - `sequential`
  - `concurrent`
- 增加同一 tick 内多人同时动作：
  - 多人同时助力同一目标田
  - 多人同时掠夺同一目标
  - 同一玩家重复点击收菜/练兵/升级
- 加 Redis + raid worker 的真实队列模式：
  - 当前掠夺仍走同步结算，适合功能验证
  - 并发压测阶段应切到真实队列
