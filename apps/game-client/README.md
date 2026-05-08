# TrinityWar Cocos Client

`apps/game-client` has been migrated from the Pixi/Vite prototype to a Cocos Creator 3.8 LTS project root.

## Open The Project

1. Install Cocos Creator 3.8 LTS.
2. Open Cocos Creator.
3. Select `D:/TrinityWar/apps/game-client` as the project folder.

## Current Layout

- `assets/scripts/core`: app shell and routing controllers.
- `assets/scripts/data`: API wrappers kept from the previous prototype.
- `assets/scripts/ui`: reusable top bar and bottom dock controllers.
- `assets/scripts/pages`: page component base classes.
- `assets/scenes`: create the main launch scene here in Cocos Creator.
- `assets/prefabs`: place reusable dock, top bar, card and dialog prefabs here.

## Migration Notes

- The previous Pixi prototype files were removed intentionally.
- Cocos scenes, prefabs and `.meta` files must be created and saved from the Cocos Creator editor.
- `npm run dev:client` now prints the editor workflow instead of starting a Vite server.
- `npm run build:client` reminds you to build from the Cocos editor; the root `npm run build` no longer includes the client.

## First Editor Tasks

1. Create a launch scene in `assets/scenes/Main.scene`.
2. Add a root Canvas node with three layers: TopBar, PageHost, BottomDock.
3. Attach `AppRoot` to the scene root.
4. Create prefabs for `TopBarController` and `BottomDockController`.
5. Create page prefabs for `home`, `building`, `farm`, `raid`, `report`, and `faction`.
6. Wire the prefabs to `AppRoot` in the Inspector.
