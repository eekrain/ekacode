export type RuntimeMode = "intake" | "plan" | "build";

export interface IChatSessionRepository {
  persistRuntimeMode(sessionId: string, mode: RuntimeMode): Promise<void>;
  updateAutoTitle(sessionId: string, title: string): Promise<boolean>;
}
