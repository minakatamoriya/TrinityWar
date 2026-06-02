export type DataSource = 'api' | 'mock';
export type ClientReadEndpoint = 'bootstrap' | 'home' | 'scenes';

export interface DataEnvelope<T> {
  data: T;
  source: DataSource;
  fallbackReason?: string;
}

export interface ClientReadPolicy<T> {
  endpoint: ClientReadEndpoint;
  path: string;
  fallback: T;
  allowFallback: boolean;
}

export interface ClientReadSourceStatus {
  source: DataSource;
  fallbackReason?: string;
}

export type ClientReadSources = Record<ClientReadEndpoint, ClientReadSourceStatus>;

export interface ClientReadSourceLabels {
  bootstrap: string;
  home: string;
  scenes: string;
}

export function buildSourceStatus<T>(envelope: DataEnvelope<T>): ClientReadSourceStatus {
  return {
    source: envelope.source,
    fallbackReason: envelope.fallbackReason,
  };
}
