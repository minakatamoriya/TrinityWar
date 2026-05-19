interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_FORCE_MOCK_READS?: string;
  readonly VITE_ALLOW_MOCK_READ_FALLBACK?: string;
  readonly VITE_FORCE_MOCK_COMMANDS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
