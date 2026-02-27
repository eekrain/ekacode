import { createChatService } from "../../application/services/chat.service.js";
import { chatSessionRepository } from "../../infrastructure/repositories/chat-session.repository.drizzle.js";

export function buildChatService() {
  return createChatService(chatSessionRepository);
}
