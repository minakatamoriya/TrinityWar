import { _decorator, Component } from 'cc';
import type { ClientSceneKey } from '@trinitywar/shared';

const { ccclass } = _decorator;

@ccclass('ScenePage')
export class ScenePage extends Component {
  public sceneKey: ClientSceneKey = 'home';

  public bindScene(_sceneKey: ClientSceneKey): void {
    this.sceneKey = _sceneKey;
  }
}
