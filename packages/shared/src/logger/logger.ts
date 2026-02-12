/**
 * Core logger implementation using Pino
 */

import pino from "pino";
import { getDefaultConfig } from "./config";
import { createPrefix } from "./formatters";
import type { Logger, LoggerConfig, LoggerContext } from "./types";

/**
 * Shared transport instance to prevent multiple exit listeners
 *
 * Pino's pino.transport() registers a process.on('exit') listener for each
 * instance. By sharing a single transport across all loggers, we prevent
 * MaxListenersExceededWarning.
 */
let sharedTransport: ReturnType<typeof pino.transport> | null = null;

/**
 * Get or create the shared transport
 */
function getSharedTransport(
  prettyPrint: boolean,
  fileOutput: boolean,
  level: string,
  filePath?: string
): ReturnType<typeof pino.transport> {
  if (sharedTransport) {
    return sharedTransport;
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
        messageFormat: (log: Record<string, unknown>) => {
          const prefix = (log.prefix as string) || "";
          const msg = (log.msg as string) || "";
          return prefix ? `${prefix} ${msg}` : msg;
        },
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

  sharedTransport = pino.transport({
    targets,
  });

  return sharedTransport;
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
