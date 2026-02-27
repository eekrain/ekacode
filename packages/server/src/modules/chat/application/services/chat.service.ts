import { getModelByReference } from "@sakti-code/core";
import { createLogger } from "@sakti-code/shared/logger";
import { generateText } from "ai";
import type {
  IChatSessionRepository,
  RuntimeMode,
} from "../../domain/repositories/chat-session.repository.js";

const logger = createLogger("server");
const SESSION_TITLE_TOKEN_LIMIT = 24;

export type { RuntimeMode } from "../../domain/repositories/chat-session.repository.js";

export function isRuntimeMode(value: unknown): value is RuntimeMode {
  return value === "intake" || value === "plan" || value === "build";
}

function normalizeGeneratedTitle(text: string): string | null {
  const stripped = text
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!stripped) return null;
  return stripped.length > 80 ? stripped.slice(0, 80).trimEnd() : stripped;
}

function deriveFallbackTitle(messageText: string): string {
  const compact = messageText.replace(/\s+/g, " ").trim();
  if (!compact) return "New Chat";
  return compact.length > 60 ? `${compact.slice(0, 60).trimEnd()}...` : compact;
}

export function createChatService(chatSessionRepository: IChatSessionRepository) {
  return {
    async persistRuntimeMode(sessionId: string, mode: RuntimeMode): Promise<void> {
      await chatSessionRepository.persistRuntimeMode(sessionId, mode);
    },
    async maybeAssignAutoSessionTitle(args: {
      sessionId: string;
      modelReference: string;
      userMessage: string;
      assistantMessage: string;
    }): Promise<void> {
      const { sessionId, modelReference, userMessage, assistantMessage } = args;

      try {
        const model = getModelByReference(modelReference);
        const titlePrompt = `Generate a short chat title (max 8 words) for this conversation.
Return only the title text, with no quotes or punctuation suffix.

User message:
${userMessage}

Assistant summary:
${assistantMessage}`;

        const { text } = await generateText({
          model,
          temperature: 0.2,
          maxOutputTokens: SESSION_TITLE_TOKEN_LIMIT,
          prompt: titlePrompt,
        });

        const candidate = normalizeGeneratedTitle(text) ?? deriveFallbackTitle(userMessage);
        const updated = await chatSessionRepository.updateAutoTitle(sessionId, candidate);

        if (updated) {
          logger.info("Auto-updated session title", {
            module: "chat",
            sessionId,
            title: candidate,
          });
        }
      } catch (error) {
        const fallback = deriveFallbackTitle(userMessage);
        const updated = await chatSessionRepository.updateAutoTitle(sessionId, fallback);
        if (updated) {
          logger.warn("Auto-title generation failed, used fallback title", {
            module: "chat",
            sessionId,
          });
          return;
        }
        logger.warn("Auto-title generation skipped", {
          module: "chat",
          sessionId,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    },
  };
}
