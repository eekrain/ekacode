import { electronAPI } from "@electron-toolkit/preload";
import { contextBridge } from "electron";

// Custom APIs for renderer
const api = {
  // Server config will be exposed in Phase 1
  getServerConfig: () => ({
    /* stub */
  }),
  onFsEvent: () => {
    // stub - will be implemented in Phase 1
    return () => {};
  },
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-expect-error - types defined in dts
  window.electron = electronAPI;
  // @ts-expect-error - types defined in dts
  window.api = api;
}
