/**
 * Invalid tool
 *
 * Used as a safe fallback when tool calls fail to parse.
 */

import { tool, zodSchema } from "ai";
import { z } from "zod";

export const invalidTool = tool({
  description: "Do not use. Fallback for malformed tool calls.",
  inputSchema: zodSchema(
    z.object({
      tool: z.string(),
      error: z.string(),
    })
  ),
  outputSchema: zodSchema(
    z.object({
      title: z.string(),
      output: z.string(),
      metadata: z.record(z.string(), z.any()),
    })
  ),
  execute: async ({ error }) => {
    return {
      title: "Invalid Tool",
      output: `The arguments provided to the tool are invalid: ${error}`,
      metadata: {},
    };
  },
});
