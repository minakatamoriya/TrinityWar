import type {
  ClientBootstrapResponse,
  ClientSceneContentResponse,
  ClientSpiritState,
  HomeSummaryResponse,
} from '@trinitywar/shared';

export function normalizeBootstrap(bootstrap: ClientBootstrapResponse): ClientBootstrapResponse {
  return {
    ...bootstrap,
    season: {
      ...bootstrap.season,
      transition: bootstrap.season.transition ? { ...bootstrap.season.transition } : undefined,
      startup: bootstrap.season.startup ? { ...bootstrap.season.startup, availableSteps: [...bootstrap.season.startup.availableSteps] } : undefined,
    },
    backpack: {
      seedInventory: { ...bootstrap.backpack.seedInventory },
      essenceInventory: { ...(bootstrap.backpack.essenceInventory ?? bootstrap.backpack.seedInventory) },
      globalItemInventory: { ...bootstrap.backpack.globalItemInventory },
      unlockedSeedIds: [...bootstrap.backpack.unlockedSeedIds],
      unlockedPlantIds: [...(bootstrap.backpack.unlockedPlantIds ?? bootstrap.backpack.unlockedSeedIds)],
      plantResearch: structuredClone(bootstrap.backpack.plantResearch ?? {}),
      starterSeedClaimed: bootstrap.backpack.starterSeedClaimed,
      tianjiTalismanClaimed: bootstrap.backpack.tianjiTalismanClaimed,
      spiritSoulClaimed: bootstrap.backpack.spiritSoulClaimed,
      dailySpiritSoulAmount: bootstrap.backpack.dailySpiritSoulAmount,
    },
  };
}

export function cloneBootstrap(bootstrap: ClientBootstrapResponse): ClientBootstrapResponse {
  return normalizeBootstrap(bootstrap);
}

export function normalizeHomeSummary(home: HomeSummaryResponse): HomeSummaryResponse {
  return {
    ...home,
    stateVersions: {
      buildingVersion: home.stateVersions?.buildingVersion ?? 1,
      walletVersion: home.stateVersions?.walletVersion ?? 1,
      armyVersion: home.stateVersions?.armyVersion ?? 1,
    },
    protectedUntil: home.protectedUntil ?? null,
    resources: (home.resources ?? []).map((resource) => ({ ...resource })),
    pendingClaims: (home.pendingClaims ?? []).map((claim) => ({ ...claim })),
    temporaryClaim: home.temporaryClaim ? { ...home.temporaryClaim } : null,
    dailyTasks: (home.dailyTasks ?? []).map((task) => ({ ...task })),
    factionTasks: (home.factionTasks ?? []).map((task) => ({ ...task, action: { ...task.action } })),
    todayContribution: home.todayContribution ?? 0,
    primaryActions: (home.primaryActions ?? []).map((action) => ({ ...action })),
  };
}

export function cloneHomeSummary(home: HomeSummaryResponse): HomeSummaryResponse {
  return normalizeHomeSummary(home);
}

export function cloneSceneContent(scenes: ClientSceneContentResponse): ClientSceneContentResponse {
  return structuredClone(scenes);
}

export function cloneSpiritState(spirit: ClientSpiritState): ClientSpiritState {
  return {
    ...spirit,
    factionAdvantage: spirit.factionAdvantage ? {
      ...spirit.factionAdvantage,
      details: [...spirit.factionAdvantage.details],
      modifiers: { ...spirit.factionAdvantage.modifiers },
    } : undefined,
    mainSlot: spirit.mainSlot ? { ...spirit.mainSlot } : null,
    slots: spirit.slots.map((slot) => ({ ...slot })),
    codex: spirit.codex.map((entry) => ({
      ...entry,
      definition: { ...entry.definition },
    })),
    readyToCompose: spirit.readyToCompose.map((entry) => ({
      ...entry,
      definition: { ...entry.definition },
    })),
  };
}
