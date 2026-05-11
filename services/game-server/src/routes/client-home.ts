import type { FastifyPluginAsync } from 'fastify';
import {
  CLIENT_API_PREFIX,
  type ClientRaidActionRequest,
  type ClientRaidActionResponse,
  type ClientFactionDonateRequest,
  type ClientClaimPendingRequest,
  type ClientClaimPendingResponse,
  type ClientCollectFieldRequest,
  type ClientCollectFieldResponse,
  type ClientRaidTargetDetailResponse,
  type ClientRecruitArmyRequest,
  type ClientResetDemoStateResponse,
  type ClientSceneContentResponse,
  type ClientStartCultivationRequest,
  type ClientStateMutationResponse,
  type ClientUpgradeBuildingRequest,
  type HomeSummaryResponse,
} from '@trinitywar/shared';
import { buildHomeSummary, buildRaidTargetDetail, buildSceneContent, claimPendingGold, claimStarterSeeds, collectFieldGold, donateFactionSupport, raidTarget, recruitArmy, resetDemoState, startCultivation, upgradeBuilding } from '../lib/client-state.js';

export const clientHomeRoutes: FastifyPluginAsync = async (server) => {
  server.get<{ Reply: HomeSummaryResponse }>(`${CLIENT_API_PREFIX}/home-summary`, {
    schema: {
      tags: ['client'],
      summary: 'Client home summary payload',
      description: 'Provides the initial home scene data for the portrait mini game client.',
      response: {
        200: {
          type: 'object',
          properties: {
            app: { type: 'string' },
            playerName: { type: 'string' },
            factionName: { type: 'string' },
            castleLevel: { type: 'number' },
            staminaStatus: { type: 'string' },
            fieldStatus: { type: 'string' },
            reportStatus: { type: 'string' },
            resources: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  value: { type: 'string' },
                  tone: { type: 'string', enum: ['vault', 'army'] },
                },
                required: ['label', 'value', 'tone'],
              },
            },
            pendingClaims: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  source: { type: 'string', enum: ['tax', 'faction'] },
                  label: { type: 'string' },
                  value: { type: 'string' },
                  description: { type: 'string' },
                },
                required: ['source', 'label', 'value', 'description'],
              },
            },
            primaryActions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key: { type: 'string' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                },
                required: ['key', 'title', 'description'],
              },
            },
          },
          required: ['app', 'playerName', 'factionName', 'castleLevel', 'staminaStatus', 'fieldStatus', 'reportStatus', 'resources', 'pendingClaims', 'primaryActions'],
        },
      },
    },
  }, async () => {
    return buildHomeSummary();
  });

  server.get<{ Reply: ClientSceneContentResponse }>(`${CLIENT_API_PREFIX}/scene-content`, {
    schema: {
      tags: ['client'],
      summary: 'Client scene content payload',
      description: 'Provides scene-specific content for building, farm, raid, report and faction pages in the portrait mini game client.',
    },
  }, async () => {
    return buildSceneContent();
  });

  server.get<{ Params: { targetId: string }; Reply: ClientRaidTargetDetailResponse }>(`${CLIENT_API_PREFIX}/raid-targets/:targetId`, {
    schema: {
      tags: ['client'],
      summary: 'Client raid target detail payload',
      description: 'Provides the modal detail payload for a visible raid target.',
    },
  }, async (request) => {
    return buildRaidTargetDetail(request.params.targetId);
  });

  server.post<{ Body: ClientClaimPendingRequest; Reply: ClientClaimPendingResponse }>(`${CLIENT_API_PREFIX}/actions/claim-pending`, {
    schema: {
      tags: ['client'],
      summary: 'Claim pending gold into vault',
      description: 'Moves either city tax or faction dividend gold into the vault up to the current vault capacity.',
    },
  }, async (request) => {
    const result = claimPendingGold(request.body);

    return {
      ...result,
      home: buildHomeSummary(),
      scenes: buildSceneContent(),
    };
  });

  server.post<{ Reply: ClientStateMutationResponse }>(`${CLIENT_API_PREFIX}/actions/claim-starter-seeds`, {
    schema: {
      tags: ['client'],
      summary: 'Claim daily starter seeds',
      description: 'Claims the daily starter seed pack once and writes it into the in-memory backpack state.',
    },
  }, async () => {
    return claimStarterSeeds();
  });

  server.post<{ Body: ClientCollectFieldRequest; Reply: ClientCollectFieldResponse }>(`${CLIENT_API_PREFIX}/actions/collect-field`, {
    schema: {
      tags: ['client'],
      summary: 'Collect field gold',
      description: 'Collects gold from a field and writes the result back into the in-memory player state.',
    },
  }, async (request) => {
    return collectFieldGold(request.body);
  });

  server.post<{ Body: ClientStartCultivationRequest; Reply: ClientStateMutationResponse }>(`${CLIENT_API_PREFIX}/actions/start-cultivation`, {
    schema: {
      tags: ['client'],
      summary: 'Start field cultivation',
      description: 'Spends vault gold to start a new cultivation round on an unlocked empty field.',
    },
  }, async (request) => {
    return startCultivation(request.body);
  });

  server.post<{ Body: ClientRecruitArmyRequest; Reply: ClientStateMutationResponse }>(`${CLIENT_API_PREFIX}/actions/recruit-army`, {
    schema: {
      tags: ['client'],
      summary: 'Recruit army units',
      description: 'Spends vault gold to recruit army units up to the current army capacity.',
    },
  }, async (request) => {
    return recruitArmy(request.body);
  });

  server.post<{ Body: ClientRaidActionRequest; Reply: ClientRaidActionResponse }>(`${CLIENT_API_PREFIX}/actions/raid-target`, {
    schema: {
      tags: ['client'],
      summary: 'Raid target with black-box resolution',
      description: 'Resolves a raid attempt against a visible target, applies gold loot, casualties, item drops and a one-hour protection window.',
    },
  }, async (request) => {
    return raidTarget(request.body);
  });

  server.post<{ Body: ClientFactionDonateRequest; Reply: ClientStateMutationResponse }>(`${CLIENT_API_PREFIX}/actions/faction-donate`, {
    schema: {
      tags: ['client'],
      summary: 'Donate gold and army to faction',
      description: 'Deducts selected gold and army immediately and converts them into faction contribution.',
    },
  }, async (request) => {
    return donateFactionSupport(request.body);
  });

  server.post<{ Body: ClientUpgradeBuildingRequest; Reply: ClientStateMutationResponse }>(`${CLIENT_API_PREFIX}/actions/upgrade-building`, {
    schema: {
      tags: ['client'],
      summary: 'Upgrade building',
      description: 'Spends vault gold to upgrade a building and updates the client-facing state.',
    },
  }, async (request) => {
    return upgradeBuilding(request.body);
  });

  server.post<{ Reply: ClientResetDemoStateResponse }>(`${CLIENT_API_PREFIX}/actions/reset-demo-state`, {
    schema: {
      tags: ['client'],
      summary: 'Reset in-memory demo state',
      description: 'Resets the validation player state back to its initial in-memory snapshot.',
    },
  }, async () => {
    return resetDemoState();
  });
};