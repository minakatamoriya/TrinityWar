import type {
  ClientSceneKey,
  ClientPlantResearchState,
  ClientSeasonSignInState,
  ClientSpiritState,
} from '@trinitywar/shared';
import { getDevLoginModeLabel, type ClientViewModel, type DevLoginSession } from '../api';
import { getSceneBackground } from '../config/sceneConfig';
import { buildBackpackResourceItems } from '../modules/backpack/backpackSelectors';
import { buildFarmFields } from '../modules/farm/farmFields';
import type { FarmOptimisticMutation } from '../modules/farm/farmOptimisticState';
import { buildSeedCatalogMap, buildSeedGroups, getFirstVisibleUnlockedSeedId } from '../modules/farm/seedPresentation';
import { findResourceByTone } from '../modules/home/homeSelectors';
import { buildSeasonProgress } from '../modules/season/seasonPresentation';
import { getFirstVisibleSpiritCodexId } from '../modules/spirit/spiritCodexPresentation';
import { buildTutorialTask, getTutorialUiRules, isNewUserInTutorial, type TutorialStage } from '../tutorial/tutorialFlow';
import { parseCapacityResourceValue } from '../utils/format';
import type { SeedCodexState } from './appStateTypes';

interface BuildAppDerivedStateInput {
  activeScene: ClientSceneKey;
  farmTick: number;
  fieldSeedAssignments: Record<string, string>;
  farmOptimisticMutations: FarmOptimisticMutation[];
  globalItemInventory: Record<string, number>;
  loginSession: DevLoginSession | null;
  plantResearchState: Record<string, ClientPlantResearchState>;
  seasonSignInState: ClientSeasonSignInState | null;
  seedCodexState: SeedCodexState | null;
  seedInventory: Record<string, number>;
  selectedRaidTargetId: string | null;
  spiritState: ClientSpiritState | null;
  topSpiritCodexSpiritId: string | null;
  tutorialStage: TutorialStage;
  unlockedSeedIds: string[];
  viewModel: ClientViewModel;
}

export function buildAppDerivedState(input: BuildAppDerivedStateInput) {
  const {
    activeScene,
    farmTick,
    fieldSeedAssignments,
    farmOptimisticMutations,
    globalItemInventory,
    loginSession,
    plantResearchState,
    seasonSignInState,
    seedCodexState,
    seedInventory,
    selectedRaidTargetId,
    spiritState,
    topSpiritCodexSpiritId,
    tutorialStage,
    unlockedSeedIds,
    viewModel,
  } = input;
  const { bootstrap, home, scenes } = viewModel;
  const selectedRaidTarget = scenes.raid.targets.find((target) => target.id === selectedRaidTargetId) ?? scenes.raid.targets[0];
  const isTutorialUser = isNewUserInTutorial(loginSession, tutorialStage);
  const mergedReportEntries = [...scenes.report.attack, ...scenes.report.defense]
    .filter((entry) => entry.title !== '系统结算')
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const visibleRaidTargets = scenes.raid.targets.slice(0, isTutorialUser ? 1 : 3);
  const raidBattleLimit = 5;
  const raidBattleUsed = Math.min(mergedReportEntries.length, raidBattleLimit);
  const activeBackgroundImage = `url(${getSceneBackground(activeScene, home.factionName)})`;
  const tutorialUiRules = getTutorialUiRules(tutorialStage, isTutorialUser);
  const vaultResource = findResourceByTone('vault', home.resources);
  const devLoginModeLabel = getDevLoginModeLabel(loginSession?.mode);
  const currentAccountName = loginSession?.player.nickname ?? home.playerName;
  const tutorialTask = buildTutorialTask(tutorialStage);
  const vaultProgress = vaultResource ? parseCapacityResourceValue(vaultResource.value) : { current: 0, capacity: 0, ratio: 0 };
  const seasonProgress = buildSeasonProgress(bootstrap.season);
  const seasonSignInDays = seasonSignInState?.days ?? [];
  const seasonSignInClaimedToday = seasonSignInState?.claimedToday ?? true;
  const seasonSignInTodayReward = seasonSignInState?.todayReward ?? 0;
  const seasonSignInMilestones = seasonSignInState?.milestones ?? [];
  const seasonSignInRecord = {
    claimedDays: seasonSignInState?.claimedDays ?? [],
  };
  const tianjiTalismanCount = spiritState?.tianjiTalisman ?? globalItemInventory.tianjiTalisman ?? 0;
  const seedCatalogMap = buildSeedCatalogMap();
  const seedGroups = buildSeedGroups({ unlockedSeedIds, seedInventory, plantResearchState });
  const selectedSeedCodexItem = seedCodexState
    ? seedGroups.flatMap((group) => group.seeds).find((seed) => seed.id === seedCodexState.selectedSeedId) ?? null
    : null;
  const firstVisibleUnlockedSeedId = getFirstVisibleUnlockedSeedId(seedGroups);
  const topSpiritCodexSelectedId = topSpiritCodexSpiritId
    ?? (spiritState ? getFirstVisibleSpiritCodexId(spiritState.codex) : null)
    ?? null;
  const spiritStableFull = spiritState ? spiritState.slots.filter((slot) => slot.spiritId).length >= spiritState.slots.length : false;
  const backpackResourceItems = buildBackpackResourceItems({ spiritState, unlockedSeedIds, seedInventory });
  const farmFields = buildFarmFields({
    fields: scenes.farm.fields,
    fieldSeedAssignments,
    optimisticMutations: farmOptimisticMutations,
    seedCatalogMap,
    farmTick,
  });
  const raidTargetsById = new Map(scenes.raid.targets.map((target) => [target.id, target]));

  return {
    activeBackgroundImage,
    backpackResourceItems,
    currentAccountName,
    devLoginModeLabel,
    farmFields,
    firstVisibleUnlockedSeedId,
    isTutorialUser,
    mergedReportEntries,
    raidBattleLimit,
    raidBattleUsed,
    raidTargetsById,
    seasonProgress,
    seasonSignInClaimedToday,
    seasonSignInDays,
    seasonSignInMilestones,
    seasonSignInRecord,
    seasonSignInTodayReward,
    seedCatalogMap,
    seedGroups,
    selectedRaidTarget,
    selectedSeedCodexItem,
    spiritStableFull,
    tianjiTalismanCount,
    topSpiritCodexSelectedId,
    tutorialTask,
    tutorialUiRules,
    vaultProgress,
    visibleRaidTargets,
  };
}
