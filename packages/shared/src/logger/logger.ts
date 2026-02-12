/**
 * Core logger implementation using Pino
 */

import pino from "pino";
import { getDefaultConfig } from "./config";
import { createPrefix } from "./formatters";
import type { Logger, LoggerConfig, LoggerContext } from "./types";

/**
 * Shared transports keyed by config.
 *
 * Pino's pino.transport() registers a process.on('exit') listener for each
 * instance. We share by transport config so loggers with identical needs reuse
 * one transport, while differing configs (e.g., file output on/off) don't
 * incorrectly share state.
 */
const sharedTransports = new Map<string, ReturnType<typeof pino.transport>>();

/**
 * Get or create the shared transport
 */
function getSharedTransport(
  prettyPrint: boolean,
  fileOutput: boolean,
  level: string,
  filePath?: string
): ReturnType<typeof pino.transport> {
  const transportKey = JSON.stringify({
    prettyPrint,
    fileOutput,
    level,
    filePath: filePath || null,
  });

  const existing = sharedTransports.get(transportKey);
  if (existing) {
    return existing;
  }

  const targets: Array<{
    target: string;
    level: string;
    options: Record<string, unknown>;
  }> = [];

  if (prettyPrint) {
    targets.push({
      target: "pino-pretty",
      level,
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname",
        // Must remain structured-cloneable because pino.transport runs in a worker thread.
        messageFormat: "{prefix} {msg}",
        customColors: "debug:blue,info:green,warn:yellow,error:red",
      },
    });
  }

  if (fileOutput) {
    targets.push({
      target: "pino/file",
      level,
      options: {
        destination: filePath || 1, // 1 = stdout
        mkdir: true,
      },
    });
  }

  // Fallback for any unexpected config.
  if (targets.length === 0) {
    targets.push({
      target: "pino/file",
      level,
      options: { destination: 1, mkdir: true },
    });
  }

  const transport = pino.transport({
    targets,
  });

  sharedTransports.set(transportKey, transport);

  return transport;
}

/**
 * Create a new logger instance
 */
export function createLogger(packageName: string, config?: Partial<LoggerConfig>): Logger {
  const defaults = getDefaultConfig();
  const finalConfig = {
    level: config?.level ?? defaults.level,
    prettyPrint: config?.prettyPrint ?? defaults.prettyPrint,
    fileOutput: config?.fileOutput ?? defaults.fileOutput,
    filePath: config?.filePath ?? defaults.filePath,
    redact: config?.redact ?? defaults.redact ?? [],
  };

  const transports = getSharedTransport(
    finalConfig.prettyPrint,
    finalConfig.fileOutput,
    finalConfig.level,
    finalConfig.filePath
  );

  const pinoLogger = pino(
    {
      level: finalConfig.level,
      redact: finalConfig.redact,
      formatters: {
        log(object: Record<string, unknown>) {
          const { time, ...rest } = object;
          const prefix = createPrefix({
            package: (rest.package as string) || packageName,
            module: rest.module as string | undefined,
            agent: rest.agent as string | undefined,
            tool: rest.tool as string | undefined,
          });
          return {
            ...object,
            prefix,
            time: time || new Date().toISOString(),
          };
        },
      },
    },
    transports
  );

  // Create base context
  const baseContext: LoggerContext = {
    package: packageName,
  };

  return createLoggerInterface(pinoLogger, baseContext);
}

/**
 * Create the Logger interface from Pino instance
 */
function createLoggerInterface(pinoLogger: pino.Logger, baseContext: LoggerContext): Logger {
  return {
    debug(msg: string, context?: Partial<LoggerContext>): void {
      pinoLogger.debug({ ...baseContext, ...context }, msg);
    },

    info(msg: string, context?: Partial<LoggerContext>): void {
      pinoLogger.info({ ...baseContext, ...context }, msg);
    },

    warn(msg: string, context?: Partial<LoggerContext>): void {
      pinoLogger.warn({ ...baseContext, ...context }, msg);
    },

    error(msg: string, err?: Error, context?: Partial<LoggerContext>): void {
      if (err) {
        pinoLogger.error({ ...baseContext, ...context, err: serializeError(err) }, msg);
      } else {
        pinoLogger.error({ ...baseContext, ...context }, msg);
      }
    },
  };
}

/**
 * Serialize Error for JSON logging
 */
function serializeError(err: Error): Record<string, unknown> {
  return {
    name: err.name,
    message: err.message,
    stack: err.stack,
    cause: err.cause,
  };
}
