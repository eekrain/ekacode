/**
 * Vite environment variable declarations
 *
 * Add VITE_ prefixed env variables here for TypeScript support.
 */

interface ImportMetaEnv {
  readonly VITE_LOG_LEVEL?: "debug" | "info" | "warn" | "error" | "silent";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
}
