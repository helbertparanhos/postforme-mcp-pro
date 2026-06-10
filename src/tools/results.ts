import { z } from "zod";
import { defineTool, limitParam, offsetParam } from "../types.js";

/**
 * Social post results: the per-platform outcome of a publish attempt — whether
 * it succeeded, the native platform post id/URL, and any error. This is the
 * second analytics surface (alongside list_account_feeds): it tells you what
 * actually happened to each post on each network.
 */
export const resultTools = [
  defineTool({
    name: "list_post_results",
    description:
      "ANALYTICS: list publishing results across posts — each row is the outcome of one post on one platform " +
      "(success/error, native post id & URL). Filter by social_post_id to see how a specific post fared on " +
      "every target account.",
    schema: z.object({
      social_post_id: z
        .string()
        .optional()
        .describe("Filter results to a single social post id."),
      limit: limitParam,
      offset: offsetParam,
    }),
    handler: async (args, client) => {
      const params: Record<string, unknown> = {};
      if (args.social_post_id) params.social_post_id = args.social_post_id;
      if (args.limit !== undefined) params.limit = args.limit;
      if (args.offset !== undefined) params.offset = args.offset;
      return client.get(`/v1/social-post-results`, { params });
    },
  }),

  defineTool({
    name: "get_post_result",
    description:
      "Get a single post result by id — the detailed outcome of one post on one platform, including the " +
      "native post URL/id and any error message.",
    schema: z.object({
      id: z.string().describe("Social post result id."),
    }),
    handler: async (args, client) => {
      return client.get(`/v1/social-post-results/${encodeURIComponent(args.id)}`);
    },
  }),
];
