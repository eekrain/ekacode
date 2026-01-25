import { ElectronAPI } from "@electron-toolkit/preload";

declare global {
  interface Window {
    electron: ElectronAPI;
    api: {
      getServerConfig: () => unknown;
      onFsEvent: (callback: (data: unknown) => void) => () => void;
    };
  }
}
