import { z, ZodTypeAny } from "zod";
import { PostForMeClient } from "./client.js";

/** MCP text content result. */
export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export type ToolHandler<S extends ZodTypeAny> = (
  args: z.infer<S>,
  client: PostForMeClient
) => Promise<unknown>;

export interface ToolDef<S extends ZodTypeAny = ZodTypeAny> {
  name: string;
  description: string;
  /** Marks the tool as a write operation — blocked when POSTFORME_READONLY=true. */
  write?: boolean;
  schema: S;
  handler: ToolHandler<S>;
}

/**
 * Schema-erased view of a tool, used for heterogeneous collections/registries
 * where the precise Zod schema of each tool can't be tracked in the array type.
 */
export interface AnyToolDef {
  name: string;
  description: string;
  write?: boolean;
  schema: ZodTypeAny;
  handler: (args: any, client: PostForMeClient) => Promise<unknown>;
}

/**
 * Declares a tool. Centralizes the boilerplate so every tool file stays terse.
 * Handlers just return JS data; serialization to MCP text content is handled
 * by the registry.
 */
export function defineTool<S extends ZodTypeAny>(def: ToolDef<S>): ToolDef<S> {
  return def;
}

/** Build the MCP `tools` listing entry (name/description/inputSchema). */
export function toListing(def: AnyToolDef) {
  // Zod 4 emits JSON Schema natively (zod-to-json-schema only understands Zod 3).
  // io "input" describes what the client sends (fields with a default stay optional).
  const jsonSchema = z.toJSONSchema(def.schema, {
    target: "draft-7",
    io: "input",
    unrepresentable: "any",
    // In "input" mode Zod 4 omits additionalProperties on plain objects (they accept and strip
    // extra keys). zod-to-json-schema emitted `false`, which tells the model not to invent fields,
    // so keep it. Objects with .catchall/.passthrough stay open as before.
    override: (ctx) => {
      const zdef = (ctx.zodSchema as any)._zod?.def;
      if (zdef?.type === "object" && zdef.catchall === undefined) {
        ctx.jsonSchema.additionalProperties = false;
      }
    },
  });
  return {
    name: def.name,
    description: def.description,
    inputSchema: jsonSchema as Record<string, unknown>,
  };
}

/**
 * Account OAuth tokens come back nested in many responses (every post carries its social_accounts). They are
 * masked before reaching the model so they never land in transcripts or logs. Set POSTFORME_SHOW_TOKENS=1 to
 * see them.
 */
const TOKEN_KEYS = new Set(["access_token", "refresh_token"]);
function maskTokens(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskTokens);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        TOKEN_KEYS.has(k) && typeof v === "string" && v ? "[hidden]" : maskTokens(v),
      ])
    );
  }
  return value;
}

/** Wrap arbitrary data into the MCP text-content result shape. */
export function ok(data: unknown): ToolResult {
  const safe = process.env.POSTFORME_SHOW_TOKENS === "1" ? data : maskTokens(data);
  const text = typeof safe === "string" ? safe : JSON.stringify(safe, null, 2);
  return { content: [{ type: "text", text }] };
}

// ── Shared Zod fragments ────────────────────────────────────────────────────

/** The 9 platforms Post for Me supports. */
export const PLATFORMS = [
  "instagram",
  "facebook",
  "tiktok",
  "youtube",
  "x",
  "linkedin",
  "pinterest",
  "bluesky",
  "threads",
] as const;

export const platformEnum = z.enum(PLATFORMS);

export const limitParam = z
  .number()
  .int()
  .positive()
  .max(100)
  .optional()
  .describe("Maximum number of items to return per page.");

export const offsetParam = z
  .number()
  .int()
  .min(0)
  .optional()
  .describe("Number of items to skip (pagination offset).");

/**
 * A single media item attached to a post. `url` references media already
 * hosted (e.g. the result of upload_media / create_media_upload_url), or any
 * publicly reachable URL. `thumbnail_url` and `tags` are optional extras the
 * API accepts for certain platforms.
 */
export const mediaItemSchema = z.object({
  url: z.string().describe("Publicly reachable URL of the image/video to attach."),
  thumbnail_url: z
    .string()
    .optional()
    .describe("Optional thumbnail/cover image URL (used by video platforms)."),
  thumbnail_timestamp_ms: z
    .number()
    .optional()
    .describe("Optional timestamp (ms) to auto-generate a video thumbnail from."),
  tags: z
    .array(z.record(z.string(), z.any()))
    .optional()
    .describe("Optional per-media tags (e.g. user/product tags) where the platform supports them."),
});

/**
 * Platform-specific overrides. Keyed by platform name; each value tweaks how the
 * post behaves on that network (e.g. Instagram Reels placement, X polls, TikTok
 * privacy/engagement, YouTube title/visibility). Documented common fields are
 * modeled, but the object is permissive (`.passthrough()` / `.catchall`) so new
 * platform options work without a client upgrade. See:
 * https://api.postforme.dev/docs
 */
const platformConfigValue = z
  .object({
    /** Override the caption for just this platform. */
    caption: z.string().optional(),
    /** Override which media goes to this platform. */
    media: z.array(mediaItemSchema).optional(),
  })
  .catchall(z.any());

export const platformConfigurationsSchema = z
  .object({
    instagram: platformConfigValue
      .describe("Instagram options (e.g. placement: 'reels'|'stories'|'timeline', share_to_feed, collaborators).")
      .optional(),
    facebook: platformConfigValue
      .describe("Facebook options (e.g. placement: 'reels'|'stories'|'timeline').")
      .optional(),
    tiktok: platformConfigValue
      .describe("TikTok options (e.g. privacy_level, disable_comment, disable_duet, disable_stitch, title).")
      .optional(),
    youtube: platformConfigValue
      .describe("YouTube options (e.g. title, visibility: 'public'|'unlisted'|'private', made_for_kids).")
      .optional(),
    x: platformConfigValue
      .describe("X/Twitter options (e.g. poll, reply_settings, quote_tweet_id).")
      .optional(),
    linkedin: platformConfigValue.describe("LinkedIn options.").optional(),
    pinterest: platformConfigValue
      .describe("Pinterest options (e.g. board_ids, link, title).")
      .optional(),
    bluesky: platformConfigValue.describe("Bluesky options.").optional(),
    threads: platformConfigValue.describe("Threads options.").optional(),
  })
  .catchall(z.any());

/**
 * Per-ACCOUNT overrides (finer-grained than platform_configurations) — tweak
 * caption/media/options for a single connected account id. Confirmed live on the
 * Post for Me API as a sibling of platform_configurations on posts.
 */
export const accountConfigurationsSchema = z.array(
  z
    .object({
      social_account_id: z
        .string()
        .describe("The connected account id this override applies to."),
      configuration: z
        .record(z.string(), z.any())
        .describe("Overrides for this specific account (caption, media, platform options)."),
    })
    .catchall(z.any())
);

/** Post lifecycle status. */
export const postStatusEnum = z
  .enum(["draft", "scheduled", "processing", "published", "error"])
  .describe("Post status.");
