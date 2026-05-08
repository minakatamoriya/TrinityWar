import { _decorator, Component, Node } from 'cc';
import type { ClientSceneKey } from '@trinitywar/shared';

const { ccclass, property } = _decorator;

@ccclass('BottomDockController')
export class BottomDockController extends Component {
  @property([Node])
  public itemNodes: Node[] = [];

  private keys: ClientSceneKey[] = [];
  private onSelect: ((key: ClientSceneKey) => void) | null = null;

  public setItems(keys: ClientSceneKey[], activeKey: ClientSceneKey, onSelect: (key: ClientSceneKey) => void): void {
    this.keys = keys;
    this.onSelect = onSelect;
    this.setActive(activeKey);
  }

  public setActive(activeKey: ClientSceneKey): void {
    this.itemNodes.forEach((itemNode, index) => {
      itemNode.opacity = this.keys[index] === activeKey ? 255 : 180;
    });
  }

  public onClickIndex(event: Event, indexText: string): void {
    if (!this.onSelect) {
      return;
    }

    const index = Number(indexText);
    const key = this.keys[index];
    if (!key) {
      return;
    }

    this.onSelect(key);
  }
}
