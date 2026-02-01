/**
 * IPC Handlers Module
 * Bridge between renderer and main process
 *
 * Provides:
 * - Server configuration
 * - File dialogs (open directory, open file, save file)
 * - Shell operations (open external, show in folder)
 * - App information (version, platform)
 * - Permission responses
 * - File watcher stubs (Phase 5)
 * - Workspace operations (clone)
 */

import { PermissionManager } from "@ekacode/core";
import { createLogger } from "@ekacode/shared/logger";
import { app, dialog, ipcMain, shell } from "electron";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const logger = createLogger("desktop:ipc");

/**
 * Allowed URL protocols for shell:openExternal
 *
 * Security: Only allow safe protocols to prevent malicious URL execution.
 * - http:, https: - Web URLs
 * - mailto: - Email links
 * - tel: - Phone numbers
 *
 * Blocked protocols include:
 * - file:, javascript:, data: - Potential security risks
 * - shell: - Could execute arbitrary commands
 */
const ALLOWED_URL_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:", "ftp:", "sftp:"]);

/**
 * Validate URL protocol for security
 *
 * @param url - The URL to validate
 * @returns true if the URL protocol is allowed, false otherwise
 * @throws Error if the URL is malformed
 */
function validateUrlProtocol(url: string): boolean {
  try {
    const parsed = new URL(url);
    const protocol = parsed.protocol;

    if (!ALLOWED_URL_PROTOCOLS.has(protocol)) {
      logger.warn("Blocked URL with disallowed protocol", {
        module: "desktop:ipc",
        url,
        protocol,
      });
      return false;
    }

    return true;
  } catch (error) {
    // URL is malformed
    logger.error("Invalid URL format", error instanceof Error ? error : undefined, {
      module: "desktop:ipc",
      url,
    });
    return false;
  }
}

/**
 * Server configuration interface
 */
export interface ServerConfig {
  port: number;
  token: string;
}

/**
 * Setup IPC handlers
 *
 * Registers all IPC handlers for communication between renderer and main process.
 *
 * @param serverConfig - Server configuration from startServer()
 */
export function setupIPCHandlers(serverConfig: ServerConfig): void {
  logger.info("Setting up IPC handlers", { module: "desktop:ipc" });

  /**
   * Get server configuration
   * Returns base URL and token for renderer to connect to the API
   */
  ipcMain.handle("get-server-config", async _event => {
    logger.debug("Server config requested", {
      module: "desktop:ipc",
      channel: "get-server-config",
    });

    return {
      baseUrl: `http://127.0.0.1:${serverConfig.port}`,
      token: serverConfig.token,
    };
  });

  /**
   * Open project directory dialog
   * Allows user to select a project directory
   */
  ipcMain.handle("dialog:openDirectory", async () => {
    logger.debug("Open directory dialog requested", {
      module: "desktop:ipc",
      channel: "dialog:openDirectory",
    });

    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Select Project Directory",
    });

    if (result.canceled || result.filePaths.length === 0) {
      logger.debug("Directory dialog canceled", {
        module: "desktop:ipc",
        channel: "dialog:openDirectory",
      });
      return null;
    }

    const selectedPath = result.filePaths[0];
    logger.debug("Directory selected", {
      module: "desktop:ipc",
      channel: "dialog:openDirectory",
      path: selectedPath,
    });

    return selectedPath;
  });

  /**
   * Open file dialog
   * Allows user to select a file
   */
  ipcMain.handle("dialog:openFile", async () => {
    logger.debug("Open file dialog requested", {
      module: "desktop:ipc",
      channel: "dialog:openFile",
    });

    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      title: "Select File",
    });

    if (result.canceled || result.filePaths.length === 0) {
      logger.debug("File dialog canceled", {
        module: "desktop:ipc",
        channel: "dialog:openFile",
      });
      return null;
    }

    const selectedPath = result.filePaths[0];
    logger.debug("File selected", {
      module: "desktop:ipc",
      channel: "dialog:openFile",
      path: selectedPath,
    });

    return selectedPath;
  });

  /**
   * Save file dialog
   * Allows user to specify where to save a file
   */
  ipcMain.handle("dialog:saveFile", async (_event, options?: { defaultPath?: string }) => {
    logger.debug("Save file dialog requested", {
      module: "desktop:ipc",
      channel: "dialog:saveFile",
      defaultPath: options?.defaultPath,
    });

    const result = await dialog.showSaveDialog({
      title: "Save File",
      defaultPath: options?.defaultPath,
    });

    if (result.canceled || !result.filePath) {
      logger.debug("Save file dialog canceled", {
        module: "desktop:ipc",
        channel: "dialog:saveFile",
      });
      return null;
    }

    logger.debug("Save file path selected", {
      module: "desktop:ipc",
      channel: "dialog:saveFile",
      path: result.filePath,
    });

    return result.filePath;
  });

  /**
   * Open external URL
   * Opens a URL in the system's default browser
   *
   * Security: Validates URL protocol before opening to prevent
   * malicious URL execution. Only allows safe protocols.
   */
  ipcMain.handle("shell:openExternal", async (_event, url: string) => {
    logger.debug("Open external URL requested", {
      module: "desktop:ipc",
      channel: "shell:openExternal",
      url,
    });

    // Validate URL protocol for security
    if (!validateUrlProtocol(url)) {
      const error = new Error(
        `URL protocol not allowed or URL is malformed. ` +
          `Allowed protocols: ${Array.from(ALLOWED_URL_PROTOCOLS).join(", ")}`
      );
      logger.error("URL validation failed", error, {
        module: "desktop:ipc",
        url,
      });
      throw error;
    }

    await shell.openExternal(url);

    logger.debug("External URL opened", {
      module: "desktop:ipc",
      channel: "shell:openExternal",
      url,
    });
  });

  /**
   * Show item in folder
   * Shows a file in the system's file manager
   */
  ipcMain.handle("shell:showItemInFolder", async (_event, fullPath: string) => {
    logger.debug("Show item in folder requested", {
      module: "desktop:ipc",
      channel: "shell:showItemInFolder",
      path: fullPath,
    });

    shell.showItemInFolder(fullPath);

    logger.debug("Item shown in folder", {
      module: "desktop:ipc",
      channel: "shell:showItemInFolder",
      path: fullPath,
    });
  });

  /**
   * Get app version
   * Returns the version from package.json
   */
  ipcMain.handle("app:getVersion", async () => {
    logger.debug("App version requested", {
      module: "desktop:ipc",
      channel: "app:getVersion",
    });

    // Version is injected by electron-vite build process
    return process.env.npm_package_version ?? "0.0.1";
  });

  /**
   * Get app platform
   * Returns the current platform (darwin, linux, win32)
   */
  ipcMain.handle("app:getPlatform", async () => {
    logger.debug("App platform requested", {
      module: "desktop:ipc",
      channel: "app:getPlatform",
    });

    return process.platform;
  });

  /**
   * Permission response from renderer
   * Handles user's decision on permission requests
   */
  ipcMain.on("permission:response", (_event, response) => {
    logger.debug("Permission response received", {
      module: "desktop:ipc",
      channel: "permission:response",
      id: response.id,
      approved: response.approved,
    });

    const permissionMgr = PermissionManager.getInstance();
    permissionMgr.handleResponse(response);
  });

  /**
   * File watch start (stub for Phase 5)
   * TODO: Implement chokidar watch in Phase 5
   */
  ipcMain.on("fs:watch-start", (_event, workspacePath: string) => {
    logger.info("File watch requested", {
      module: "desktop:ipc",
      channel: "fs:watch-start",
      workspacePath,
    });
    // TODO: Implement chokidar watch in Phase 5
  });

  /**
   * File watch stop (stub for Phase 5)
   * TODO: Implement chokidar stop in Phase 5
   */
  ipcMain.on("fs:watch-stop", _event => {
    logger.info("File watch stop requested", {
      module: "desktop:ipc",
      channel: "fs:watch-stop",
    });
    // TODO: Implement chokidar stop in Phase 5
  });

  /**
   * Clone git repository
   * Clones a repository to a temporary workspace directory
   */
  ipcMain.handle("workspace:clone", async (_event, options: { url: string; branch: string }) => {
    logger.info("Clone repository requested", {
      module: "desktop:ipc",
      channel: "workspace:clone",
      url: options.url,
      branch: options.branch,
    });

    // Validate URL
    const allowedHosts = ["github.com", "gitlab.com", "bitbucket.org"];
    try {
      const url = new URL(options.url);
      if (!allowedHosts.includes(url.hostname)) {
        throw new Error(
          `URL hostname not allowed: ${url.hostname}. Only ${allowedHosts.join(", ")} are supported.`
        );
      }
    } catch (error) {
      logger.error("Invalid URL format", error instanceof Error ? error : undefined, {
        module: "desktop:ipc",
        url: options.url,
      });
      throw new Error("Invalid URL format");
    }

    // Create workspace directory in user data
    const workspaceDir = join(app.getPath("home"), "ekacode-workspaces");
    mkdirSync(workspaceDir, { recursive: true });

    // Extract repo name from URL
    const urlParts = options.url.replace(/\.git$/, "").split(/[/\\]/);
    const repoName = urlParts[urlParts.length - 1] || "repository";
    const clonePath = join(workspaceDir, repoName);

    logger.info("Cloning repository", {
      module: "desktop:ipc",
      to: clonePath,
    });

    try {
      // Check if directory already exists
      const args = [
        "clone",
        "--depth",
        "1",
        "--single-branch",
        "--branch",
        options.branch || "main",
        options.url,
        clonePath,
      ];

      execSync("git " + args.join(" "), {
        encoding: "utf-8",
        stdio: "pipe",
        timeout: 60000, // 60 seconds
      });

      logger.info("Repository cloned successfully", {
        module: "desktop:ipc",
        path: clonePath,
      });

      return clonePath;
    } catch (error) {
      const stderr = (error as { stderr?: string }).stderr || "";
      logger.error("Failed to clone repository", error instanceof Error ? error : undefined, {
        module: "desktop:ipc",
        stderr,
      });

      // Parse common git errors
      if (stderr.includes("Repository not found") || stderr.includes("could not read")) {
        throw new Error("Repository not found or access denied");
      }
      if (stderr.includes("Could not resolve host")) {
        throw new Error("Could not resolve repository host. Check your internet connection.");
      }
      if (stderr.includes("Permission denied")) {
        throw new Error("Permission denied. You may need to authenticate.");
      }
      if (stderr.includes("branch.*not found")) {
        throw new Error(`Branch '${options.branch}' not found`);
      }

      throw new Error(stderr.split("\n")[0] || "Failed to clone repository");
    }
  });

  logger.info("IPC handlers registered", { module: "desktop:ipc" });
}
