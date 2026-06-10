import { z } from "zod";
import { readFile, stat } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import axios from "axios";
import { defineTool } from "../types.js";
import { assertSafeRemoteUrl, MAX_MEDIA_BYTES } from "../security.js";

/** Minimal extension → MIME map for common social media assets. */
const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".m4v": "video/x-m4v",
};

function guessContentType(nameOrUrl: string, fallback?: string): string {
  if (fallback) return fallback;
  const ext = extname(nameOrUrl.split("?")[0]).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

/**
 * Validate a local file_path before reading it, to stop upload_media from being
 * abused as a file-exfiltration channel (e.g. reading /etc/passwd, .env or cloud
 * credentials and pushing them to public storage):
 *  - the extension must be a known media type (rejects non-media files);
 *  - if POSTFORME_MEDIA_DIR is set, the resolved path must stay inside it.
 */
function assertSafeLocalMedia(filePath: string): void {
  const ext = extname(filePath).toLowerCase();
  if (!MIME_BY_EXT[ext]) {
    throw new Error(
      `Refusing to upload "${basename(filePath)}": extension "${ext || "(none)"}" is not a recognized ` +
        `media type. Allowed: ${Object.keys(MIME_BY_EXT).join(", ")}.`
    );
  }
  const allowedDir = process.env.POSTFORME_MEDIA_DIR;
  if (allowedDir) {
    const root = resolve(allowedDir);
    const target = resolve(filePath);
    if (target !== root && !target.startsWith(root + (root.endsWith("/") ? "" : "/")) &&
        !target.startsWith(root + "\\")) {
      throw new Error(
        `Refusing to read "${target}": outside the allowed POSTFORME_MEDIA_DIR (${root}).`
      );
    }
  }
}

/**
 * Pull the upload URL and the resulting public/media URL out of the
 * create-upload-url response, tolerating a few possible field names so we don't
 * break if the API tweaks its payload shape.
 */
function extractUploadFields(resp: any): { uploadUrl: string; mediaUrl: string } {
  const uploadUrl =
    resp?.upload_url ?? resp?.uploadUrl ?? resp?.signed_url ?? resp?.url ?? resp?.put_url;
  // Deliberately NOT falling back to resp?.url here: that field can be the
  // signed PUT url (with an upload token in its query string). The explicit
  // uploadUrl.split("?")[0] fallback below strips any such token.
  const mediaUrl =
    resp?.media_url ?? resp?.mediaUrl ?? resp?.public_url ?? resp?.publicUrl;
  if (!uploadUrl) {
    throw new Error(
      `create-upload-url did not return an upload URL. Raw response: ${JSON.stringify(resp)}`
    );
  }
  return { uploadUrl, mediaUrl: mediaUrl ?? uploadUrl.split("?")[0] };
}

export const mediaTools = [
  defineTool({
    name: "create_media_upload_url",
    description:
      "Get a signed URL to upload a media file. Returns an upload_url (PUT your bytes there) and the media URL " +
      "to reference in a post. Prefer upload_media if you want the upload done for you in one step.",
    write: true,
    schema: z.object({
      content_type: z
        .string()
        .optional()
        .describe("MIME type of the file you'll upload (e.g. 'image/jpeg', 'video/mp4')."),
      file_name: z.string().optional().describe("Optional original file name."),
    }),
    handler: async (args, client) => {
      const body: Record<string, unknown> = {};
      if (args.content_type) body.content_type = args.content_type;
      if (args.file_name) body.file_name = args.file_name;
      return client.post(`/v1/media/create-upload-url`, { body });
    },
  }),

  defineTool({
    name: "upload_media",
    description:
      "One-step media upload: provide a local file path OR a public URL, and this generates a signed URL, " +
      "uploads the bytes, and returns { media_url } ready to drop into create_post/publish_now/schedule_post " +
      "media. Use this whenever you need to attach an image or video.",
    write: true,
    schema: z
      .object({
        file_path: z
          .string()
          .optional()
          .describe("Absolute path to a local image/video file to upload."),
        source_url: z
          .string()
          .optional()
          .describe("Public URL of media to fetch and re-upload (alternative to file_path)."),
        content_type: z
          .string()
          .optional()
          .describe("Override the MIME type (auto-detected from extension otherwise)."),
      })
      .refine((v) => !!v.file_path !== !!v.source_url, {
        message: "Provide exactly one of file_path or source_url.",
      }),
    handler: async (args, client) => {
      // 1. Load the bytes — either from disk or from a remote URL.
      let bytes: Buffer;
      let nameHint: string;
      let detectedType = args.content_type; // local, never mutate the parsed input
      if (args.file_path) {
        assertSafeLocalMedia(args.file_path);
        const info = await stat(args.file_path);
        if (!info.isFile()) {
          throw new Error(`"${args.file_path}" is not a regular file.`);
        }
        if (info.size > MAX_MEDIA_BYTES) {
          throw new Error(
            `File is ${info.size} bytes, over the ${MAX_MEDIA_BYTES}-byte limit for upload_media.`
          );
        }
        bytes = await readFile(args.file_path);
        nameHint = basename(args.file_path);
      } else {
        // assertSafeRemoteUrl resolves DNS and rejects non-public IPs; maxRedirects:0
        // ensures a 3xx hop can't escape that check via a rebind/redirect.
        const url = await assertSafeRemoteUrl(args.source_url as string);
        const res = await axios.get(url.toString(), {
          responseType: "arraybuffer",
          maxContentLength: MAX_MEDIA_BYTES,
          maxBodyLength: MAX_MEDIA_BYTES,
          maxRedirects: 0,
          validateStatus: () => true,
        });
        if (res.status >= 400) {
          throw new Error(`Failed to fetch source_url (HTTP ${res.status}): ${url}`);
        }
        if (res.status >= 300) {
          throw new Error(
            `source_url returned a redirect (HTTP ${res.status}). For safety, redirects are not followed — ` +
              `pass the final media URL directly.`
          );
        }
        bytes = Buffer.from(res.data);
        nameHint = basename(url.pathname) || "media";
        // Prefer the server-reported content type when we weren't given one.
        if (!detectedType && res.headers["content-type"]) {
          detectedType = String(res.headers["content-type"]).split(";")[0];
        }
      }

      const contentType = guessContentType(nameHint, detectedType);

      // 2. Ask Post for Me for a signed upload URL.
      const created = await client.post(`/v1/media/create-upload-url`, {
        body: { content_type: contentType, file_name: nameHint },
      });
      const { uploadUrl, mediaUrl } = extractUploadFields(created);

      // 3. PUT the bytes to the signed URL.
      await client.uploadToSignedUrl(uploadUrl, bytes, contentType);

      return {
        media_url: mediaUrl,
        content_type: contentType,
        file_name: nameHint,
        bytes: bytes.length,
        note: "Pass media_url inside the `media` array of create_post/publish_now/schedule_post.",
      };
    },
  }),
];
