import { _decorator, Component, Node, Prefab, instantiate } from 'cc';
import type { ClientSceneKey } from '@trinitywar/shared';
import { ClientApi } from '../data/ClientApi';
import { BottomDockController } from '../ui/BottomDockController';
import { TopBarController } from '../ui/TopBarController';

const { ccclass, property } = _decorator;

type PagePrefabEntry = {
  key: ClientSceneKey;
  prefab: Prefab | null;
};

@ccclass('AppRoot')
export class AppRoot extends Component {
  @property(Node)
  public pageHost: Node | null = null;

  @property(TopBarController)
  public topBar: TopBarController | null = null;

  @property(BottomDockController)
  public bottomDock: BottomDockController | null = null;

  @property([Prefab])
  public pagePrefabs: Prefab[] = [];

  private activeModule: ClientSceneKey = 'home';
  private activePage: Node | null = null;
  private readonly pageOrder: ClientSceneKey[] = ['home', 'building', 'farm', 'raid', 'report', 'faction'];

  public async start(): Promise<void> {
    this.topBar?.setTitle(this.activeModule);
    this.bottomDock?.setItems(this.pageOrder, this.activeModule, (nextKey) => this.switchModule(nextKey));

    await Promise.all([
      ClientApi.loadClientBootstrap(),
      ClientApi.loadHomeSummary(),
      ClientApi.loadClientSceneContent(),
    ]);

    this.switchModule(this.activeModule);
  }

  public switchModule(nextKey: ClientSceneKey): void {
    if (!this.pageHost) {
      return;
    }

    this.activeModule = nextKey;
    this.topBar?.setTitle(nextKey);
    this.bottomDock?.setActive(nextKey);

    if (this.activePage) {
      this.activePage.destroy();
      this.activePage = null;
    }

    const prefab = this.resolvePrefab(nextKey);
    if (!prefab) {
      return;
    }

    const instance = instantiate(prefab);
    instance.name = `${nextKey}-page`;
    this.pageHost.addChild(instance);
    this.activePage = instance;
  }

  private resolvePrefab(key: ClientSceneKey): Prefab | null {
    const index = this.pageOrder.indexOf(key);
    if (index < 0) {
      return null;
    }

    return this.pagePrefabs[index] ?? null;
  }
}
