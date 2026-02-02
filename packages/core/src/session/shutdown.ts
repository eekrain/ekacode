/**
 * Shutdown handler
 *
 * Handles graceful shutdown with checkpoint saving for all active sessions.
 */

import type { SessionManager } from "./manager";

/**
 * Shutdown handler class
 *
 * Registers signal handlers for SIGTERM, SIGINT, and error handlers
 * to ensure checkpoints are saved before process exit.
 */
export class ShutdownHandler {
  private sessionManager: SessionManager;
  private isShuttingDown = false;

  constructor(sessionManager: SessionManager) {
    this.sessionManager = sessionManager;
    this.setupSignalHandlers();
  }

  /**
   * Setup signal and error handlers
   */
  private setupSignalHandlers(): void {
    // Handle graceful shutdown on SIGTERM (Docker, systemd)
    process.on("SIGTERM", () => this.handleShutdown("SIGTERM"));

    // Handle graceful shutdown on SIGINT (Ctrl+C)
    process.on("SIGINT", () => this.handleShutdown("SIGINT"));

    // Handle uncaught exceptions
    process.on("uncaughtException", error => {
      console.error("Uncaught exception:", error);
      this.handleShutdown("uncaughtException");
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", reason => {
      console.error("Unhandled rejection:", reason);
      this.handleShutdown("unhandledRejection");
    });
  }

  /**
   * Handle graceful shutdown
   *
   * Saves checkpoints for all active sessions before exiting.
   *
   * @param signal - The signal that triggered shutdown
   */
  private async handleShutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      console.log("Shutdown already in progress...");
      return;
    }

    this.isShuttingDown = true;
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

    try {
      // Get all active sessions
      const activeSessions = this.sessionManager.getActiveSessions();
      console.log(`Saving checkpoints for ${activeSessions.length} active sessions...`);

      // Save checkpoints for all active sessions
      const savePromises = activeSessions.map(async session => {
        try {
          await session.saveCheckpointToDisk();
          console.log(`✓ Checkpoint saved for session ${session.sessionId}`);
        } catch (error) {
          console.error(`✗ Failed to save checkpoint for session ${session.sessionId}:`, error);
        }
      });

      // Wait for all checkpoints to save (with timeout)
      await Promise.race([
        Promise.all(savePromises),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Shutdown timeout")), 10000)),
      ]);

      console.log("All checkpoints saved. Shutting down...");
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  }
}
