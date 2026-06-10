import { z } from "zod";
import {
  defineTool,
  mediaItemSchema,
  platformConfigurationsSchema,
  accountConfigurationsSchema,
} from "../types.js";

/**
 * Post previews: render what a post would look like on each target platform
 * BEFORE publishing — useful for confirming caption truncation, media layout and
 * per-platform configuration with the user.
 */
export const previewTools = [
  defineTool({
    name: "create_post_preview",
    description:
      "Generate a preview of how a post would appear on each target platform, without publishing it. Pass the " +
      "same caption/media/social_accounts/platform_configurations you'd send to create_post. Great for a " +
      "confirm-before-publish step.",
    // Not marked write: previewing does not mutate state (no post is created),
    // so it stays usable in POSTFORME_READONLY mode for confirm-before-publish.
    schema: z.object({
      caption: z.string().optional().describe("The caption to preview."),
      social_accounts: z
        .array(z.string())
        .optional()
        .describe("Social account ids to preview the post for."),
      media: z.array(mediaItemSchema).optional().describe("Media to include in the preview."),
      platform_configurations: platformConfigurationsSchema
        .optional()
        .describe("Per-platform overrides to reflect in the preview."),
      account_configurations: accountConfigurationsSchema
        .optional()
        .describe("Per-account overrides to reflect in the preview ({ social_account_id, configuration })."),
    }),
    handler: async (args, client) => {
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(args)) {
        if (v !== undefined) body[k] = v;
      }
      return client.post(`/v1/social-post-previews`, { body });
    },
  }),
];
