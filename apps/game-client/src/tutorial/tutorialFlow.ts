import type { ClientSceneKey } from '@trinitywar/shared';
import type { DevLoginSession } from '../api';
import type { CharacterDialogSceneId } from '../dialog/dialogLibrary';

export type TutorialStage = 'home' | 'farm' | 'spirit' | 'raid' | 'faction' | 'completed';
export type TutorialRaidHubTab = 'targets' | 'reports';
export type TutorialFactionTab = 'overview' | 'donate' | 'rank';

export interface TutorialTask {
  title: string;
  description: string;
  actionLabel: string;
  targetScene: ClientSceneKey;
}

export interface TutorialFarmUiRules {
  showFactionAdvantage: boolean;
  showFarmBoard: boolean;
  showLandDeeds: boolean;
  visibleFieldLimit: number | null;
}

export interface TutorialArmyUiRules {
  showFactionAdvantage: boolean;
  showCodexButton: boolean;
  showResourcePanel: boolean;
  showStableSlots: boolean;
  allowOwnedPetDetail: boolean;
  showPetActionTabs: boolean;
}

export interface TutorialFactionUiRules {
  showContributionPanel: boolean;
  showHeroNotes: boolean;
  showTabs: boolean;
  showComparison: boolean;
  showTodayTasks: boolean;
  showContributionLogs: boolean;
  showRankings: boolean;
}

export interface TutorialRaidUiRules {
  showTabs: boolean;
  showFactionAdvantage: boolean;
  showToolbar: boolean;
  visibleTargetLimit: number | null;
  allowFollow: boolean;
  allowDeepIntel: boolean;
}

export interface TutorialUiRules {
  showTopResourceButtons: boolean;
  showHomeDailyTasks: boolean;
  showHomeFactionTasks: boolean;
  farm: TutorialFarmUiRules;
  army: TutorialArmyUiRules;
  raid: TutorialRaidUiRules;
  faction: TutorialFactionUiRules;
}

export interface TutorialUnlockItem {
  id: string;
  label: string;
  kind: 'plant' | 'spirit' | 'feature';
  description?: string;
}

export interface TutorialUnlockModalConfig {
  title: string;
  summary: string;
  items: TutorialUnlockItem[];
}

export type TutorialFlowAction =
  | { type: 'setStage'; stage: TutorialStage }
  | { type: 'navigate'; scene: ClientSceneKey; raidHubTab?: TutorialRaidHubTab; factionTab?: TutorialFactionTab }
  | { type: 'dialog'; sceneId: CharacterDialogSceneId; force?: boolean; delayMs?: number; onCompleteActions?: TutorialFlowAction[] }
  | { type: 'unlockModal'; modal: TutorialUnlockModalConfig; afterConfirmActions?: TutorialFlowAction[] };

export type TutorialFlowEvent =
  | 'starterSeedsClaimed'
  | 'fieldCultivationStarted'
  | 'farmRewardConfirmed'
  | 'spiritAwardConfirmed'
  | 'raidSettled'
  | 'factionStipendClaimed';

export const tutorialStageStorageKeyPrefix = 'trinitywar.tutorialStage';
export const TUTORIAL_STARTER_SEED_ID = 'qilingya';

const tutorialStageRank: Record<TutorialStage, number> = {
  home: 0,
  farm: 1,
  spirit: 2,
  raid: 3,
  faction: 4,
  completed: 5,
};

const sceneTutorialUnlockStage: Record<ClientSceneKey, TutorialStage> = {
  home: 'home',
  farm: 'farm',
  raid: 'spirit',
  report: 'raid',
  building: 'completed',
  faction: 'faction',
  social: 'completed',
};

const tutorialTasks: Partial<Record<TutorialStage, TutorialTask>> = {
  home: {
    title: '领取启灵芽 x1',
    description: '先收下引导者给你的启灵芽。获得可种植资格后，再去第一块田培育它。',
    actionLabel: '领取启灵芽',
    targetScene: 'home',
  },
  farm: {
    title: '收获启灵芽',
    description: '启灵芽成熟后先收获，再去创建第一只灵宠。',
    actionLabel: '查看农场',
    targetScene: 'farm',
  },
  spirit: {
    title: '创建第一只灵宠',
    description: '在空主位中选择初始灵宠，并设定五行属性。创建后会自动设为主位。',
    actionLabel: '创建灵宠',
    targetScene: 'raid',
  },
  raid: {
    title: '完成教程战斗',
    description: '挑战教程对象，理解战斗结果和收益。',
    actionLabel: '进入探索',
    targetScene: 'report',
  },
  faction: {
    title: '领取阵营俸禄',
    description: '完成首战后回到阵营领取补给。第一次领取会解锁青灵麦和风云稻种植资格。',
    actionLabel: '前往阵营',
    targetScene: 'faction',
  },
};

const firstStipendUnlockModal: TutorialUnlockModalConfig = {
  title: '种植资格已解锁',
  summary: '阵营俸禄已发放，以下灵植现在可以回到田地种植。',
  items: [
    {
      id: 'qinglingmai',
      label: '青灵麦',
      kind: 'plant',
      description: '普通稳收灵植',
    },
    {
      id: 'xunyamai',
      label: '风云稻',
      kind: 'plant',
      description: '短周期灵植',
    },
  ],
};

export function getTutorialStageStorageKey(playerId: string): string {
  return `${tutorialStageStorageKeyPrefix}:${playerId}`;
}

export function isTutorialStage(value: string | null | undefined): value is TutorialStage {
  return value === 'home' || value === 'farm' || value === 'spirit' || value === 'raid' || value === 'faction' || value === 'completed';
}

export function isNewUserInTutorial(session: DevLoginSession | null | undefined, stage: TutorialStage): boolean {
  return session?.mode === 'new-user' && stage !== 'completed';
}

export function getInitialTutorialStage(session: DevLoginSession | null): TutorialStage {
  if (!session || session.mode !== 'new-user') {
    return 'completed';
  }

  if (typeof window === 'undefined') {
    return 'home';
  }

  const storedStage = window.localStorage.getItem(getTutorialStageStorageKey(session.player.id));
  if (storedStage === 'building') {
    return 'completed';
  }

  return isTutorialStage(storedStage) ? storedStage : 'home';
}

export function canOpenSceneInTutorial(scene: ClientSceneKey, stage: TutorialStage): boolean {
  return tutorialStageRank[stage] >= tutorialStageRank[sceneTutorialUnlockStage[scene]];
}

export function getLockedSceneMessage(scene: ClientSceneKey): string {
  if (scene === 'farm') {
    return '先从首页任务进入农场。';
  }

  if (scene === 'raid') {
    return '先完成第一轮种田，再创建灵宠。';
  }

  if (scene === 'report') {
    return '先完成首宠创建，再进入探索教程。';
  }

  if (scene === 'faction') {
    return '先完成教程战斗，再领取阵营俸禄。';
  }

  if (scene === 'building') {
    return '完成新手引导后开放法术。';
  }

  if (scene === 'social') {
    return '完成新手引导后开放社交。';
  }

  return '完成新手引导后开放。';
}

export function buildTutorialTask(stage: TutorialStage): TutorialTask | null {
  return tutorialTasks[stage] ?? null;
}

export function getTutorialFlowActions(event: TutorialFlowEvent): TutorialFlowAction[] {
  if (event === 'starterSeedsClaimed') {
    return [
      { type: 'setStage', stage: 'farm' },
      { type: 'navigate', scene: 'farm' },
      { type: 'dialog', sceneId: 'tutorial.farm.start', force: true },
    ];
  }

  if (event === 'fieldCultivationStarted') {
    return [
      { type: 'dialog', sceneId: 'tutorial.farm.wait', force: true },
    ];
  }

  if (event === 'farmRewardConfirmed') {
    return [
      { type: 'setStage', stage: 'spirit' },
      { type: 'navigate', scene: 'raid' },
      { type: 'dialog', sceneId: 'tutorial.spirit.start', force: true },
    ];
  }

  if (event === 'spiritAwardConfirmed') {
    return [
      { type: 'setStage', stage: 'raid' },
      { type: 'navigate', scene: 'report', raidHubTab: 'targets' },
      { type: 'dialog', sceneId: 'tutorial.raid.start', force: true },
    ];
  }

  if (event === 'raidSettled') {
    return [
      { type: 'setStage', stage: 'faction' },
      { type: 'navigate', scene: 'faction', factionTab: 'overview' },
      { type: 'dialog', sceneId: 'tutorial.faction.start', force: true },
    ];
  }

  return [
    { type: 'setStage', stage: 'completed' },
    {
      type: 'unlockModal',
      modal: firstStipendUnlockModal,
      afterConfirmActions: [
        {
          type: 'dialog',
          sceneId: 'tutorial.completed',
          force: true,
          onCompleteActions: [
            { type: 'navigate', scene: 'home' },
          ],
        },
      ],
    },
  ];
}

export function getTutorialUiRules(stage: TutorialStage, isTutorialActive: boolean): TutorialUiRules {
  if (!isTutorialActive || stage === 'completed') {
    return {
      showTopResourceButtons: true,
      showHomeDailyTasks: true,
      showHomeFactionTasks: true,
      farm: {
        showFactionAdvantage: true,
        showFarmBoard: true,
        showLandDeeds: true,
        visibleFieldLimit: null,
      },
      army: {
        showFactionAdvantage: true,
        showCodexButton: true,
        showResourcePanel: true,
        showStableSlots: true,
        allowOwnedPetDetail: true,
        showPetActionTabs: true,
      },
      raid: {
        showTabs: true,
        showFactionAdvantage: true,
        showToolbar: true,
        visibleTargetLimit: null,
        allowFollow: true,
        allowDeepIntel: true,
      },
      faction: {
        showContributionPanel: true,
        showHeroNotes: true,
        showTabs: true,
        showComparison: true,
        showTodayTasks: true,
        showContributionLogs: true,
        showRankings: true,
      },
    };
  }

  return {
    showTopResourceButtons: false,
    showHomeDailyTasks: false,
    showHomeFactionTasks: false,
    farm: {
      showFactionAdvantage: false,
      showFarmBoard: false,
      showLandDeeds: false,
      visibleFieldLimit: 1,
    },
    army: {
      showFactionAdvantage: false,
      showCodexButton: false,
      showResourcePanel: false,
      showStableSlots: false,
      allowOwnedPetDetail: false,
      showPetActionTabs: false,
    },
    raid: {
      showTabs: false,
      showFactionAdvantage: false,
      showToolbar: false,
      visibleTargetLimit: 1,
      allowFollow: false,
      allowDeepIntel: false,
    },
    faction: {
      showContributionPanel: false,
      showHeroNotes: false,
      showTabs: false,
      showComparison: false,
      showTodayTasks: false,
      showContributionLogs: false,
      showRankings: false,
    },
  };
}
