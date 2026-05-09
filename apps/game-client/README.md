# TrinityWar Web Validation Client

`apps/game-client` is now the gameplay validation frontend built with Vite, React and TypeScript.

## Goals

1. 用最低前端成本验证首页、建筑、农场、掠夺、战报、阵营六个核心页面。
2. 优先复用现有后端 `client` 接口，服务不可用时自动退回本地演示数据。
3. 保持一套适合后续迁移到小游戏壳层的 2D 面板式信息架构。

## Run The Client

1. 在仓库根目录执行依赖安装。
2. 运行 `npm run dev:client` 启动验证前端。
3. 如需联调，再额外运行 `npm run dev:server`。

## Current Layout

- `src/App.tsx`: 页面壳、导航、弹窗和本地交互状态。
- `src/api.ts`: 读取 bootstrap、home-summary 和 scene-content。
- `src/mockData.ts`: 服务不可用时的本地验证数据。
- `src/styles.css`: 竖屏 2D 面板式界面样式。

## Validation Scope

1. 首页负责资源概览、今日状态、快捷入口和关键提醒。
2. 建筑页负责长期成长线和升级入口。
3. 农场页负责外场阶段、收取说明和培育入口。
4. 掠夺页负责目标选择、风险收益比较和出兵模拟。
5. 战报页负责防守/进攻切换和结果回看。
6. 阵营页负责总览、上缴分红和排行榜切换。
