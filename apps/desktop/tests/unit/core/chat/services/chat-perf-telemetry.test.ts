import {
  getChatPerfSnapshot,
  recordChatPerfCounter,
  resetChatPerfTelemetry,
} from "@/core/chat/services/chat-perf-telemetry";
import { beforeEach, describe, expect, it } from "vitest";

describe("chat-perf-telemetry", () => {
  beforeEach(() => {
    resetChatPerfTelemetry();
  });

  it("records counters and exposes snapshot", () => {
    recordChatPerfCounter("sseEvents");
    recordChatPerfCounter("streamDataParts", 3);
    recordChatPerfCounter("turnProjectionMs", 2.5);

    const snapshot = getChatPerfSnapshot();
    expect(snapshot.counters.sseEvents).toBe(1);
    expect(snapshot.counters.streamDataParts).toBe(3);
    expect(snapshot.counters.turnProjectionMs).toBe(2.5);
  });
});
