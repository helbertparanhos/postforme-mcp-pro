#!/usr/bin/env node
import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { createRequire } from "node:module";
import { PostForMeClient } from "./client.js";
import { AnyToolDef, toListing, ok } from "./types.js";
import { allTools, rawTool } from "./tools/index.js";
import { isRawReadOnly } from "./tools/raw.js";

// Single source of truth for the version: package.json (avoids drift).
const require = createRequire(import.meta.url);
const { version: PKG_VERSION } = require("../package.json") as { version: string };

// ── Configuration from environment ──────────────────────────────────────────
const apiKey = process.env.POSTFORME_API_KEY ?? process.env.POST_FOR_ME_API_KEY ?? "";
const readonly = String(process.env.POSTFORME_READONLY ?? "").toLowerCase() === "true";
const disableRaw = String(process.env.POSTFORME_DISABLE_RAW ?? "").toLowerCase() === "true";

if (!apiKey) {
  console.error(
    "[postforme-mcp-pro] POSTFORME_API_KEY is not set. " +
      "Create one in the Post for Me dashboard (Settings → API Keys)."
  );
  process.exit(1);
}

const client = new PostForMeClient({
  apiKey,
  baseUrl: process.env.POSTFORME_BASE_URL,
  timeoutMs: process.env.POSTFORME_TIMEOUT_MS ? Number(process.env.POSTFORME_TIMEOUT_MS) : undefined,
  maxRetries: process.env.POSTFORME_MAX_RETRIES ? Number(process.env.POSTFORME_MAX_RETRIES) : undefined,
});

// ── Assemble the active tool set ─────────────────────────────────────────────
const active: AnyToolDef[] = [...allTools];
if (!disableRaw) active.push(rawTool);

const byName = new Map<string, AnyToolDef>();
for (const t of active) {
  if (byName.has(t.name)) {
    console.error(`[postforme-mcp-pro] Duplicate tool name detected: ${t.name}`);
    process.exit(1);
  }
  byName.set(t.name, t);
}

const listing = active.map(toListing);

// ── Server ───────────────────────────────────────────────────────────────────
const server = new Server(
  { name: "postforme-mcp-pro", version: PKG_VERSION },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: listing }));

server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
  const def = byName.get(request.params.name);
  if (!def) {
    throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${request.params.name}`);
  }

  const rawArgs = request.params.arguments ?? {};

  // Readonly gate — block writes, but always allow postforme_raw GETs.
  if (readonly && def.write) {
    const isRawGet = def.name === "postforme_raw" && isRawReadOnly(rawArgs);
    if (!isRawGet) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text:
              `Blocked: '${def.name}' is a write operation and POSTFORME_READONLY=true. ` +
              `Unset POSTFORME_READONLY to enable writes.`,
          },
        ],
      };
    }
  }

  // Validate args against the tool's Zod schema for actionable error messages.
  const parsed = def.schema.safeParse(rawArgs);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return {
      isError: true,
      content: [{ type: "text", text: `Invalid arguments for '${def.name}': ${issues}` }],
    };
  }

  try {
    const result = await def.handler(parsed.data, client);
    return ok(result) as CallToolResult;
  } catch (error: any) {
    const message =
      error?.message ?? (typeof error === "string" ? error : JSON.stringify(error));
    return {
      isError: true,
      content: [{ type: "text", text: message }],
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `[postforme-mcp-pro] ready — ${active.length} tools` +
      `${readonly ? " (READONLY)" : ""}${disableRaw ? " (raw disabled)" : ""}.`
  );
}

main().catch((err) => {
  console.error("[postforme-mcp-pro] fatal:", err);
  process.exit(1);
});
