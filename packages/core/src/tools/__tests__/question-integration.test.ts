/**
 * T-025: Clarification-loop validation and integration tests
 *
 * Tests ensuring required clarifications work properly.
 */

import { Instance } from "@/instance";
import { QuestionManager } from "@/session/question-manager";
import { questionTool } from "@/tools/question";
import { beforeEach, describe, expect, it } from "vitest";

type QuestionExecuteOptions = Parameters<NonNullable<typeof questionTool.execute>>[1];

describe("Clarification Loop Integration Tests (T-025)", () => {
  const manager = QuestionManager.getInstance();
  const toolOptions: QuestionExecuteOptions = {
    toolCallId: "question-tool-call",
    messages: [],
  };

  beforeEach(() => {
    manager.reset();
  });

  describe("Multiple Question Lifecycle", () => {
    it("handles multiple sequential questions", async () => {
      const answers: string[] = [];

      await Instance.provide({
        directory: "/tmp",
        sessionID: "session-seq-001",
        messageID: "message-1",
        async fn() {
          const execute = questionTool.execute;
          if (!execute) {
            throw new Error("questionTool.execute is undefined");
          }

          const run = execute(
            {
              questions: [
                {
                  question: "What is the feature name?",
                  options: [{ label: "Authentication" }, { label: "Authorization" }],
                },
              ],
            },
            toolOptions
          );

          const [pending] = manager.getPendingRequests();

          setTimeout(() => {
            const reply = "Authentication";
            manager.reply({ id: pending!.id, reply });
            answers.push(reply);
          }, 50);

          const result1 = (await run) as { metadata?: Record<string, unknown> };
          expect(result1.metadata).toBeDefined();

          // Ask second question
          const run2 = execute(
            {
              questions: [
                {
                  question: "What authentication protocol?",
                  options: [{ label: "OAuth2" }, { label: "JWT" }],
                },
              ],
            },
            toolOptions
          );

          const [pending2] = manager.getPendingRequests();

          setTimeout(() => {
            const reply = "OAuth2";
            manager.reply({ id: pending2!.id, reply });
            answers.push(reply);
          }, 50);

          const result2 = (await run2) as { metadata?: Record<string, unknown> };
          expect(result2.metadata).toBeDefined();

          return result2;
        },
      });

      await new Promise(resolve => setTimeout(resolve, 150));
      expect(answers).toEqual(["Authentication", "OAuth2"]);
    });

    it("clears pending list after all questions answered", async () => {
      await Instance.provide({
        directory: "/tmp",
        sessionID: "session-pending-001",
        messageID: "message-2",
        async fn() {
          const execute = questionTool.execute;
          if (!execute) {
            throw new Error("questionTool.execute is undefined");
          }

          const run = execute(
            {
              questions: [
                {
                  question: "Question 1?",
                },
              ],
            },
            toolOptions
          );

          const [pending] = manager.getPendingRequests();
          expect(pending).toBeDefined();
          expect(pending?.questions[0].question).toBe("Question 1?");

          manager.reply({ id: pending!.id, reply: "Answer 1" });

          const result1 = (await run) as { metadata?: Record<string, unknown> };
          expect(result1.metadata).toBeDefined();
          expect(manager.getPendingRequests()).toHaveLength(0);

          const run2 = execute(
            {
              questions: [
                {
                  question: "Question 2?",
                },
              ],
            },
            toolOptions
          );

          const [pending2] = manager.getPendingRequests();
          expect(pending2).toBeDefined();
          expect(pending2?.questions[0].question).toBe("Question 2?");

          manager.reply({ id: pending2!.id, reply: "Answer 2" });

          const result2 = (await run2) as { metadata?: Record<string, unknown> };
          expect(result2.metadata).toBeDefined();
          expect(manager.getPendingRequests()).toHaveLength(0);

          return result2;
        },
      });
    });
  });

  describe("Question Rejection", () => {
    it("allows agent to proceed after rejection", async () => {
      let rejectionProcessed = false;

      await Instance.provide({
        directory: "/tmp",
        sessionID: "session-reject-001",
        messageID: "message-3",
        async fn() {
          const execute = questionTool.execute;
          if (!execute) {
            throw new Error("questionTool.execute is undefined");
          }

          const run = execute(
            {
              questions: [
                {
                  question: "Skip this step?",
                },
              ],
            },
            toolOptions
          );

          const [pending] = manager.getPendingRequests();

          setTimeout(() => {
            manager.reject({ id: pending!.id, reason: "Not needed" });
            rejectionProcessed = true;
          }, 50);

          const result = (await run) as { metadata?: Record<string, unknown> };
          expect(result.metadata).toBeDefined();
          expect(rejectionProcessed).toBe(true);

          return result;
        },
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(rejectionProcessed).toBe(true);
      expect(manager.getPendingRequests()).toHaveLength(0);
    });
  });

  describe("Multiple Selection Support", () => {
    it("supports multiple option selection", async () => {
      await Instance.provide({
        directory: "/tmp",
        sessionID: "session-multi-001",
        messageID: "message-multi-1",
        async fn() {
          const execute = questionTool.execute;
          if (!execute) {
            throw new Error("questionTool.execute is undefined");
          }

          const run = execute(
            {
              questions: [
                {
                  question: "Which features to include?",
                  options: [
                    { label: "Auth" },
                    { label: "Logging" },
                    { label: "Monitoring" },
                    { label: "Caching" },
                  ],
                  multiple: true,
                },
              ],
            },
            toolOptions
          );

          const [pending] = manager.getPendingRequests();

          expect(pending?.questions[0].multiple).toBe(true);

          const selectedFeatures = ["Auth", "Logging", "Monitoring"];
          manager.reply({ id: pending!.id, reply: selectedFeatures });

          const result = (await run) as { metadata?: Record<string, unknown> };
          expect(result.metadata).toBeDefined();

          return result;
        },
      });
    });
  });
});
