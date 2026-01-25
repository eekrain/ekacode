"use strict";
const preload = require("@electron-toolkit/preload");
const electron = require("electron");
const api = {
  // Server config will be exposed in Phase 1
  getServerConfig: () => ({
    /* stub */
  }),
  onFsEvent: (_callback) => {
    return () => {
    };
  }
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = preload.electronAPI;
  window.api = api;
}
