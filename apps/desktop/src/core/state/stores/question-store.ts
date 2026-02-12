/**
 * Question Store
 *
 * Unified state management for question requests.
 */

import { createStore, produce } from "solid-js/store";

/** Question request status */
export type QuestionStatus = "pending" | "answered";

/** Question request data */
export interface QuestionRequest {
  /** Unique question request ID */
  id: string;
  /** Session ID this request belongs to */
  sessionID: string;
  /** Message ID this request is associated with */
  messageID: string;
  /** The question text */
  question: string;
  /** Optional answer options */
  options?: string[];
  /** Current status */
  status: QuestionStatus;
  /** User's answer (if answered) */
  answer?: unknown;
  /** Timestamp of creation */
  timestamp: number;
  /** Tool call ID if applicable */
  callID?: string;
}

/** Question store state */
export interface QuestionState {
  /** Questions indexed by ID */
  byId: Record<string, QuestionRequest>;
  /** Question IDs grouped by session */
  bySession: Record<string, string[]>;
  /** Ordered list of pending question IDs */
  pendingOrder: string[];
}

/** Question store actions */
export interface QuestionActions {
  /** Add a new question request */
  add: (request: QuestionRequest) => void;
  /** Answer a question */
  answer: (id: string, answer: unknown) => void;
  /** Get all questions for a session */
  getBySession: (sessionID: string) => QuestionRequest[];
  /** Get all pending questions */
  getPending: () => QuestionRequest[];
  /** Get a specific question by ID */
  getById: (id: string) => QuestionRequest | undefined;
  /** Remove a question request */
  remove: (id: string) => void;
  /** Clear all answered questions for a session */
  clearAnswered: (sessionID: string) => void;
}

/** Create empty question state */
export function createEmptyQuestionState(): QuestionState {
  return {
    byId: {},
    bySession: {},
    pendingOrder: [],
  };
}

/** Create question store with actions */
export function createQuestionStore(
  initialState: QuestionState = createEmptyQuestionState()
): [get: QuestionState, actions: QuestionActions] {
  const [state, setState] = createStore(initialState);

  const actions: QuestionActions = {
    add: (request: QuestionRequest) => {
      setState(
        produce((draft: QuestionState) => {
          const existing = draft.byId[request.id];
          if (existing) {
            const previousSessionIds = draft.bySession[existing.sessionID];
            if (previousSessionIds) {
              const existingIndex = previousSessionIds.indexOf(request.id);
              if (existingIndex > -1) {
                previousSessionIds.splice(existingIndex, 1);
              }
            }

            const pendingIndex = draft.pendingOrder.indexOf(request.id);
            if (pendingIndex > -1) {
              draft.pendingOrder.splice(pendingIndex, 1);
            }
          }

          // Upsert byId
          draft.byId[request.id] = request;

          // Upsert session grouping
          if (!draft.bySession[request.sessionID]) {
            draft.bySession[request.sessionID] = [];
          }
          if (!draft.bySession[request.sessionID].includes(request.id)) {
            draft.bySession[request.sessionID].push(request.id);
          }

          // Add to pending order if pending
          if (request.status === "pending" && !draft.pendingOrder.includes(request.id)) {
            draft.pendingOrder.push(request.id);
          }
        })
      );
    },

    answer: (id: string, answer: unknown) => {
      setState(
        produce((draft: QuestionState) => {
          const request = draft.byId[id];
          if (!request) return;

          // Update status and answer
          request.status = "answered";
          request.answer = answer;

          // Remove from pending order
          const pendingIndex = draft.pendingOrder.indexOf(id);
          if (pendingIndex > -1) {
            draft.pendingOrder.splice(pendingIndex, 1);
          }
        })
      );
    },

    getBySession: (sessionID: string) => {
      const questionIds = state.bySession[sessionID] || [];
      return questionIds.map((id: string) => state.byId[id]).filter(Boolean);
    },

    getPending: () => {
      return state.pendingOrder.map((id: string) => state.byId[id]).filter(Boolean);
    },

    getById: (id: string) => {
      return state.byId[id];
    },

    remove: (id: string) => {
      setState(
        produce((draft: QuestionState) => {
          const request = draft.byId[id];
          if (!request) return;

          // Remove from byId
          delete draft.byId[id];

          // Remove from session grouping
          const sessionQuestions = draft.bySession[request.sessionID];
          if (sessionQuestions) {
            const index = sessionQuestions.indexOf(id);
            if (index > -1) {
              sessionQuestions.splice(index, 1);
            }
          }

          // Remove from pending order
          const pendingIndex = draft.pendingOrder.indexOf(id);
          if (pendingIndex > -1) {
            draft.pendingOrder.splice(pendingIndex, 1);
          }
        })
      );
    },

    clearAnswered: (sessionID: string) => {
      setState(
        produce((draft: QuestionState) => {
          const questionIds = draft.bySession[sessionID] || [];
          const idsToRemove: string[] = [];

          questionIds.forEach((id: string) => {
            const request = draft.byId[id];
            if (request && request.status === "answered") {
              idsToRemove.push(id);
              delete draft.byId[id];
            }
          });

          // Update session grouping
          draft.bySession[sessionID] = questionIds.filter(
            (id: string) => !idsToRemove.includes(id)
          );

          // Update pending order
          draft.pendingOrder = draft.pendingOrder.filter((id: string) => !idsToRemove.includes(id));
        })
      );
    },
  };

  return [state, actions];
}
