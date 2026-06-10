import { z } from "zod";
import { defineTool, platformEnum, limitParam, offsetParam } from "../types.js";

/**
 * Social account management: list/inspect connected accounts, kick off the OAuth
 * connect flow, update or disconnect accounts, and pull a connected account's
 * feed (the analytics surface — recent posts with engagement metrics).
 */
export const accountTools = [
  defineTool({
    name: "list_social_accounts",
    description:
      "List the social accounts connected to your Post for Me workspace. Optionally filter by platform " +
      "(instagram, tiktok, x, ...). Returns account ids you pass to create_post via social_accounts.",
    schema: z.object({
      platform: platformEnum.optional().describe("Filter accounts by platform."),
      username: z.string().optional().describe("Filter by account username/handle."),
      id: z
        .array(z.string())
        .optional()
        .describe("Filter to specific social account ids."),
      limit: limitParam,
      offset: offsetParam,
    }),
    handler: async (args, client) => {
      const params: Record<string, unknown> = {};
      if (args.platform) params.platform = args.platform;
      if (args.username) params.username = args.username;
      if (args.id) params.id = args.id;
      if (args.limit !== undefined) params.limit = args.limit;
      if (args.offset !== undefined) params.offset = args.offset;
      return client.get(`/v1/social-accounts`, { params });
    },
  }),

  defineTool({
    name: "get_social_account",
    description: "Get a single connected social account by id, including platform, username and status.",
    schema: z.object({
      id: z.string().describe("Social account id."),
    }),
    handler: async (args, client) => {
      return client.get(`/v1/social-accounts/${encodeURIComponent(args.id)}`);
    },
  }),

  defineTool({
    name: "create_social_account",
    description:
      "Manually create/connect a social account by supplying its platform and credentials/tokens. " +
      "For the standard interactive OAuth flow, prefer create_auth_url instead.",
    write: true,
    schema: z.object({
      platform: platformEnum.describe("Platform to connect."),
      username: z.string().optional().describe("Account username/handle."),
      access_token: z.string().optional().describe("OAuth access token for the account."),
      refresh_token: z.string().optional().describe("OAuth refresh token, if applicable."),
      external_id: z
        .string()
        .optional()
        .describe("The platform's native account id, if you have it."),
      metadata: z
        .record(z.any())
        .optional()
        .describe("Any additional credential/config fields the platform requires."),
    }),
    handler: async (args, client) => {
      return client.post(`/v1/social-accounts`, { body: args });
    },
  }),

  defineTool({
    name: "update_social_account",
    description: "Update a connected social account (e.g. refresh stored credentials or metadata).",
    write: true,
    schema: z.object({
      id: z.string().describe("Social account id to update."),
      username: z.string().optional().describe("New username/handle."),
      access_token: z.string().optional().describe("New OAuth access token."),
      refresh_token: z.string().optional().describe("New OAuth refresh token."),
      metadata: z.record(z.any()).optional().describe("Fields to merge into the account metadata."),
    }),
    handler: async (args, client) => {
      const { id, ...body } = args;
      return client.patch(`/v1/social-accounts/${encodeURIComponent(id)}`, { body });
    },
  }),

  defineTool({
    name: "create_auth_url",
    description:
      "Start the OAuth connect flow for a platform. Returns a URL — open it in a browser to authorize the " +
      "account; once approved, it appears in list_social_accounts. Use this to connect a new Instagram/TikTok/X/etc.",
    write: true,
    schema: z.object({
      platform: platformEnum.describe("Platform to connect via OAuth."),
      external_id: z
        .string()
        .optional()
        .describe("Your own reference id to correlate the resulting account on your side."),
      redirect_url: z
        .string()
        .optional()
        .describe("Where to send the user after authorizing (overrides the workspace default)."),
    }),
    handler: async (args, client) => {
      return client.post(`/v1/social-accounts/auth-url`, { body: args });
    },
  }),

  defineTool({
    name: "disconnect_social_account",
    description:
      "Disconnect a social account — revokes Post for Me's access. The account stops being usable for posting " +
      "until reconnected via create_auth_url.",
    write: true,
    schema: z.object({
      id: z.string().describe("Social account id to disconnect."),
    }),
    handler: async (args, client) => {
      return client.post(`/v1/social-accounts/${encodeURIComponent(args.id)}/disconnect`);
    },
  }),

  defineTool({
    name: "list_account_feeds",
    description:
      "ANALYTICS: list the recent feed for a connected account — the posts on that platform, optionally with " +
      "engagement metrics (likes, comments, views, etc.). Use this to pull performance data for a given account.",
    schema: z.object({
      social_account_id: z.string().describe("The connected social account id to read the feed of."),
      limit: limitParam,
      offset: offsetParam,
    }),
    handler: async (args, client) => {
      const params: Record<string, unknown> = {};
      if (args.limit !== undefined) params.limit = args.limit;
      if (args.offset !== undefined) params.offset = args.offset;
      return client.get(
        `/v1/social-account-feeds/${encodeURIComponent(args.social_account_id)}`,
        { params }
      );
    },
  }),
];
