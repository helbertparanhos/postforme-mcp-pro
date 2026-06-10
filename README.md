# postforme-mcp-pro 📱

> The most complete **Post for Me** MCP server — publish, schedule, edit, delete and analyze social posts across **9 platforms** from any MCP client.

[![npm version](https://img.shields.io/npm/v/postforme-mcp-pro.svg?style=flat-square)](https://www.npmjs.com/package/postforme-mcp-pro)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/helbertparanhos/postforme-mcp-pro?style=flat-square)](https://github.com/helbertparanhos/postforme-mcp-pro/stargazers)

`postforme-mcp-pro` wraps the [Post for Me](https://www.postforme.dev/) API in **27+ fully-typed MCP tools** (one per operation) plus a `postforme_raw` escape hatch and a readonly safety mode. Unlike the official MCP — which exposes only a doc-search + sandboxed code-execution tool ("code mode") — every operation here is a first-class, directly-callable tool, so the model can post, schedule and pull analytics without writing SDK code.

**Platforms:** Instagram · Facebook · TikTok · YouTube · X · LinkedIn · Pinterest · Bluesky · Threads

## Why this server

- **27+ typed tools** — `create_post`, `schedule_post`, `publish_now`, `create_draft`, `upload_media`, `list_account_feeds`, `list_post_results`, account & webhook management, and more.
- **High-level shortcuts** — `publish_now` / `schedule_post` / `create_draft` / `reschedule_post` / `upload_media` collapse common multi-step flows into one call.
- **One-step media upload** — `upload_media` takes a local file path or a public URL, gets a signed URL, uploads the bytes, and hands back a `media_url` ready to attach.
- **Per-platform tuning** — `platform_configurations` models Instagram Reels, X polls, TikTok privacy, YouTube visibility, etc., and stays permissive for new options.
- **Readonly safety mode** — `POSTFORME_READONLY=true` blocks every write; great for analytics-only sessions.
- **`postforme_raw`** — call any endpoint for 100% API coverage, even brand-new ones.
- **Resilient client** — Bearer auth, retries on 429/5xx with backoff, actionable error messages.

## Install

```bash
npm install
npm run build
```

Or run published (after release) without cloning:

```bash
npx -y postforme-mcp-pro
```

## Configuration

Copy `.env.example` → `.env` and set your key:

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTFORME_API_KEY` | ✅ | Your Post for Me API key (Dashboard → Settings → API Keys). |
| `POSTFORME_BASE_URL` | — | Override the API base URL for self-hosted/open-source deployments. Default `https://api.postforme.dev`. |
| `POSTFORME_READONLY` | — | `true` blocks all write tools (only reads + `postforme_raw` GET run). |
| `POSTFORME_DISABLE_RAW` | — | `true` removes the `postforme_raw` tool. |
| `POSTFORME_TIMEOUT_MS` | — | Per-request timeout (default `60000`). |
| `POSTFORME_MAX_RETRIES` | — | Max retries on 429/5xx/network (default `3`). |

## Test locally

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Add to Claude Code

`.claude/settings.json` → `mcpServers`:

```json
"postforme": {
  "command": "node",
  "args": ["projects/postforme-mcp-pro/dist/index.js"],
  "env": { "POSTFORME_API_KEY": "pfm_xxx" }
}
```

## Add to Claude Desktop

`%APPDATA%\Claude\claude_desktop_config.json` (Windows) / `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
"postforme": {
  "command": "node",
  "args": ["/abs/path/projects/postforme-mcp-pro/dist/index.js"],
  "env": { "POSTFORME_API_KEY": "pfm_xxx" }
}
```

Cursor uses the same config shape in its MCP file.

## Tools

### Social accounts
| Tool | Description |
|------|-------------|
| `list_social_accounts` | List connected accounts (filter by platform/username). |
| `get_social_account` | Get one account by id. |
| `create_social_account` | Connect an account by supplying credentials. |
| `update_social_account` | Update stored credentials/metadata. |
| `create_auth_url` | Start the OAuth connect flow (returns a URL). |
| `disconnect_social_account` | Revoke access for an account. |
| `list_account_feeds` | **Analytics:** recent feed + engagement metrics for an account. |

### Posts
| Tool | Description |
|------|-------------|
| `create_post` | Create a post (publish now, schedule, or draft) across accounts. |
| `publish_now` | Shortcut: publish immediately. |
| `schedule_post` | Shortcut: schedule for an ISO-8601 time. |
| `create_draft` | Shortcut: save as draft. |
| `get_post` | Get a post by id. |
| `list_posts` | List posts (filter by status). |
| `update_post` | Edit caption/media/accounts/schedule/config. |
| `reschedule_post` | Shortcut: change a scheduled time. |
| `delete_post` | Delete a post. |

### Results & previews
| Tool | Description |
|------|-------------|
| `list_post_results` | **Analytics:** per-platform publish outcomes. |
| `get_post_result` | One post result by id. |
| `create_post_preview` | Preview how a post renders per platform. |

### Media
| Tool | Description |
|------|-------------|
| `create_media_upload_url` | Get a signed upload URL (2-step flow). |
| `upload_media` | **One-step:** upload a local file or remote URL → returns `media_url`. |

### Webhooks
| Tool | Description |
|------|-------------|
| `list_webhooks` · `get_webhook` · `create_webhook` · `update_webhook` · `delete_webhook` | Manage event subscriptions. |

### Escape hatch
| Tool | Description |
|------|-------------|
| `postforme_raw` | Call any `/v1/...` endpoint directly (method, path, params, body). |

## Companion skill

`/postforme` (in [`skill/SKILL.md`](skill/SKILL.md)) orchestrates these tools into guided workflows: `post`, `schedule`, `campaign`, `analytics`, `accounts`, `media`. Copy it into `.claude/skills/` to use it in Claude Code.

## Example

```
You: post "Lançamos a v2 🚀" no instagram e no x, com a imagem ./hero.png
→ list_social_accounts            (get the instagram + x account ids)
→ upload_media { file_path: "./hero.png" }   → media_url
→ create_post_preview             (optional, confirm look)
→ publish_now { social_accounts: [...], caption: "...", media: [{ url: media_url }] }
→ list_post_results               (report success/links per platform)
```

## Comparison with the official MCP

| | postforme-mcp-pro | official `post-for-me-mcp` |
|---|---|---|
| Tool model | **27 typed tools**, one per operation | 2 tools (doc-search + code-execution sandbox) |
| Calls | Direct tool calls | Model must write SDK code in a sandbox |
| Shortcuts | `publish_now` / `schedule_post` / `create_draft` / `upload_media` | — |
| Safety | `POSTFORME_READONLY` mode + SSRF/file-read hardening | — |
| Escape hatch | `postforme_raw` (any `/v1` endpoint) | code execution |
| Companion skill | `/postforme` guided workflows | — |

## Security

`upload_media` hardens remote fetches against SSRF (DNS resolution + public-unicast IP
validation, no redirects, size cap) and restricts local file reads to recognized media
extensions (optionally to `POSTFORME_MEDIA_DIR`). `postforme_raw` paths are validated to stay
on the versioned API surface. See [REVIEW.md](REVIEW.md) for the full audit.

## License

MIT © Helbert Paranhos / Strat Academy
