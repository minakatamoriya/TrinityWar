import { _decorator, Component, Label } from 'cc';
import type { ClientSceneKey } from '@trinitywar/shared';

const { ccclass, property } = _decorator;

const MODULE_TITLES: Record<ClientSceneKey, string> = {
  home: '主城',
  building: '建筑',
  farm: '农场',
  raid: '掠夺',
  report: '战报',
  faction: '阵营',
};

@ccclass('TopBarController')
export class TopBarController extends Component {
  @property(Label)
  public titleLabel: Label | null = null;

  public setTitle(sceneKey: ClientSceneKey): void {
    if (!this.titleLabel) {
      return;
    }

    this.titleLabel.string = MODULE_TITLES[sceneKey];
  }
}
