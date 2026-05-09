import type { FastifyPluginAsync } from 'fastify';
import {
  CLIENT_API_PREFIX,
  type ClientClaimPendingRequest,
  type ClientClaimPendingResponse,
  type ClientCollectFieldRequest,
  type ClientResetDemoStateResponse,
  type ClientSceneContentResponse,
  type ClientStartCultivationRequest,
  type ClientStateMutationResponse,
  type ClientTransferGoldRequest,
  type ClientUpgradeBuildingRequest,
  type HomeSummaryResponse,
} from '@trinitywar/shared';
import { buildHomeSummary, buildSceneContent, claimPendingGold, collectFieldGold, resetDemoState, startCultivation, transferGold, upgradeBuilding } from '../lib/client-state.js';

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
                  tone: { type: 'string', enum: ['vault', 'wallet'] },
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

  server.post<{ Body: ClientCollectFieldRequest; Reply: ClientStateMutationResponse }>(`${CLIENT_API_PREFIX}/actions/collect-field`, {
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

  server.post<{ Body: ClientUpgradeBuildingRequest; Reply: ClientStateMutationResponse }>(`${CLIENT_API_PREFIX}/actions/upgrade-building`, {
    schema: {
      tags: ['client'],
      summary: 'Upgrade building',
      description: 'Spends vault gold to upgrade a building and updates the client-facing state.',
    },
  }, async (request) => {
    return upgradeBuilding(request.body);
  });

  server.post<{ Body: ClientTransferGoldRequest; Reply: ClientStateMutationResponse }>(`${CLIENT_API_PREFIX}/actions/transfer-gold`, {
    schema: {
      tags: ['client'],
      summary: 'Transfer gold between vault and wallet',
      description: 'Transfers gold between vault and wallet while respecting both source balance and target capacity.',
    },
  }, async (request) => {
    return transferGold(request.body);
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