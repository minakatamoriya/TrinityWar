# TrinityWar Cocos Client Migration

## Status

`apps/game-client` is now a Cocos Creator project root.

The previous Pixi/Vite prototype entry files were removed.

## What Was Preserved

- Client API endpoints remain the same.
- Module routing still targets `home`, `building`, `farm`, `raid`, `report`, and `faction`.
- Shared DTO imports continue to come from `@trinitywar/shared`.

## What Must Be Done In Cocos Creator

1. Create the main scene and save it under `assets/scenes`.
2. Create prefabs for each main page under `assets/prefabs/pages`.
3. Create prefabs for `TopBarController` and `BottomDockController`.
4. Wire the prefabs and nodes to `AppRoot` from the Inspector.
5. Set the project build target to WeChat Mini Game.

## Recommended First Layout

1. Canvas design resolution: `720 x 1280`
2. Top bar height: `88`
3. Bottom dock height: `132`
4. Main page safe width: `660`
5. Content panels use 9-slice sprites instead of code-drawn borders.

## Recommended Asset Structure

- `assets/art/common`
- `assets/art/topbar`
- `assets/art/dock`
- `assets/art/home`
- `assets/art/building`
- `assets/art/farm`
- `assets/art/raid`
- `assets/art/report`
- `assets/art/faction`
- `assets/prefabs/common`
- `assets/prefabs/pages`
