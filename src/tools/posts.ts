import { z } from "zod";
import {
  defineTool,
  mediaItemSchema,
  platformConfigurationsSchema,
  accountConfigurationsSchema,
  postStatusEnum,
  limitParam,
  offsetParam,
} from "../types.js";

/** Fields shared by every post-creation tool (create_post and the shortcuts). */
const postBodyShape = {
  caption: z
    .string()
    .optional()
    .describe("The post text/caption. Can be overridden per-platform via platform_configurations."),
  social_accounts: z
    .array(z.string())
    .min(1)
    .describe("Social account ids to publish to (from list_social_accounts). Required."),
  media: z
    .array(mediaItemSchema)
    .optional()
    .describe("Media to attach (images/videos). Each item references a public URL — see upload_media."),
  external_id: z
    .string()
    .optional()
    .describe("Your own reference id for this post, echoed back in results/webhooks."),
  platform_configurations: platformConfigurationsSchema
    .optional()
    .describe("Per-platform overrides (Instagram Reels, X polls, TikTok privacy, YouTube title, etc.)."),
  account_configurations: accountConfigurationsSchema
    .optional()
    .describe(
      "Per-ACCOUNT overrides (finer-grained than platform_configurations) — tweak caption/media/options for a " +
        "single connected account id."
    ),
};

function buildPostBody(args: Record<string, any>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (v !== undefined) body[k] = v;
  }
  return body;
}

export const postTools = [
  defineTool({
    name: "create_post",
    description:
      "Create a social post across one or more connected accounts/platforms. This is the primary publishing " +
      "tool. Set scheduled_at (ISO-8601) to schedule, status='draft' to save without publishing, or omit both " +
      "to publish immediately. Use platform_configurations for per-network tweaks. For common cases the " +
      "shortcuts publish_now / schedule_post / create_draft are simpler.",
    write: true,
    schema: z.object({
      ...postBodyShape,
      scheduled_at: z
        .string()
        .optional()
        .describe("ISO-8601 timestamp to schedule the post (e.g. '2026-07-01T14:30:00Z'). Omit to publish now."),
      status: postStatusEnum
        .optional()
        .describe("Explicit status. Usually leave unset; use 'draft' to save without publishing."),
    }),
    handler: async (args, client) => {
      return client.post(`/v1/social-posts`, { body: buildPostBody(args) });
    },
  }),

  defineTool({
    name: "publish_now",
    description:
      "Shortcut: publish a post immediately to the given accounts. Equivalent to create_post with no " +
      "scheduled_at and status='published'.",
    write: true,
    schema: z.object({ ...postBodyShape }),
    handler: async (args, client) => {
      return client.post(`/v1/social-posts`, {
        body: { ...buildPostBody(args), status: "published" },
      });
    },
  }),

  defineTool({
    name: "schedule_post",
    description:
      "Shortcut: schedule a post for a future time. Equivalent to create_post with scheduled_at set and " +
      "status='scheduled'.",
    write: true,
    schema: z.object({
      ...postBodyShape,
      scheduled_at: z
        .string()
        .describe("ISO-8601 timestamp for when to publish (e.g. '2026-07-01T14:30:00Z'). Required."),
    }),
    handler: async (args, client) => {
      return client.post(`/v1/social-posts`, {
        body: { ...buildPostBody(args), status: "scheduled" },
      });
    },
  }),

  defineTool({
    name: "create_draft",
    description:
      "Shortcut: save a post as a draft without publishing or scheduling it. Equivalent to create_post with " +
      "status='draft'.",
    write: true,
    schema: z.object({ ...postBodyShape }),
    handler: async (args, client) => {
      return client.post(`/v1/social-posts`, {
        body: { ...buildPostBody(args), status: "draft" },
      });
    },
  }),

  defineTool({
    name: "get_post",
    description: "Get a single social post by id, including its status, caption, media and target accounts.",
    schema: z.object({
      id: z.string().describe("Social post id."),
    }),
    handler: async (args, client) => {
      return client.get(`/v1/social-posts/${encodeURIComponent(args.id)}`);
    },
  }),

  defineTool({
    name: "list_posts",
    description:
      "List social posts, optionally filtered by status (draft/scheduled/published/error) and paginated. " +
      "Use this to review queued, scheduled or published content.",
    schema: z.object({
      status: postStatusEnum.optional().describe("Filter by post status."),
      external_id: z.string().optional().describe("Filter by your own external_id."),
      limit: limitParam,
      offset: offsetParam,
    }),
    handler: async (args, client) => {
      const params: Record<string, unknown> = {};
      if (args.status) params.status = args.status;
      if (args.external_id) params.external_id = args.external_id;
      if (args.limit !== undefined) params.limit = args.limit;
      if (args.offset !== undefined) params.offset = args.offset;
      return client.get(`/v1/social-posts`, { params });
    },
  }),

  defineTool({
    name: "update_post",
    description:
      "Update an existing post by id — change the caption, media, target accounts, schedule or " +
      "platform_configurations. Works on drafts and scheduled posts.",
    write: true,
    schema: z.object({
      id: z.string().describe("Social post id to update."),
      caption: z.string().optional().describe("New caption/text."),
      social_accounts: z
        .array(z.string())
        .optional()
        .describe("Replace the set of target social account ids."),
      media: z.array(mediaItemSchema).optional().describe("Replace the attached media."),
      scheduled_at: z
        .string()
        .optional()
        .describe("New ISO-8601 schedule time."),
      status: postStatusEnum.optional().describe("New status."),
      platform_configurations: platformConfigurationsSchema
        .optional()
        .describe("Replace per-platform overrides."),
      account_configurations: accountConfigurationsSchema
        .optional()
        .describe("Replace per-account overrides ({ social_account_id, configuration })."),
    }),
    handler: async (args, client) => {
      const { id, ...rest } = args;
      return client.put(`/v1/social-posts/${encodeURIComponent(id)}`, {
        body: buildPostBody(rest),
      });
    },
  }),

  defineTool({
    name: "reschedule_post",
    description:
      "Shortcut: move a scheduled post to a new time. Equivalent to update_post with only scheduled_at set.",
    write: true,
    schema: z.object({
      id: z.string().describe("Social post id to reschedule."),
      scheduled_at: z
        .string()
        .describe("New ISO-8601 timestamp to publish at (e.g. '2026-07-02T09:00:00Z')."),
    }),
    handler: async (args, client) => {
      return client.put(`/v1/social-posts/${encodeURIComponent(args.id)}`, {
        body: { scheduled_at: args.scheduled_at, status: "scheduled" },
      });
    },
  }),

  defineTool({
    name: "delete_post",
    description: "Delete a social post by id (drafts, scheduled or published records).",
    write: true,
    schema: z.object({
      id: z.string().describe("Social post id to delete."),
    }),
    handler: async (args, client) => {
      await client.del(`/v1/social-posts/${encodeURIComponent(args.id)}`);
      return { deleted: true, id: args.id };
    },
  }),
];
