import type { ClientBootstrapResponse, ClientSceneContentResponse, HomeSummaryResponse } from '@trinitywar/shared';

const API_BASE_URL = 'http://127.0.0.1:3000';

async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export class ClientApi {
  public static loadClientBootstrap(): Promise<ClientBootstrapResponse> {
    return requestJson<ClientBootstrapResponse>('/api/client/bootstrap');
  }

  public static loadHomeSummary(): Promise<HomeSummaryResponse> {
    return requestJson<HomeSummaryResponse>('/api/client/home-summary');
  }

  public static loadClientSceneContent(): Promise<ClientSceneContentResponse> {
    return requestJson<ClientSceneContentResponse>('/api/client/scene-content');
  }
}
