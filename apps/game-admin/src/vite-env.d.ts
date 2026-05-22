/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ADMIN_DEBUG_KEY?: string;
  readonly VITE_ADMIN_WRITE_DEBUG_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
