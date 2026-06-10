# Changelog

All notable changes to this project are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/), versioning follows [SemVer](https://semver.org/).

## [1.0.0] - 2026-06-10

### Added
- Initial release — **27 typed MCP tools** + `postforme_raw` escape hatch covering the
  Post for Me API across 9 platforms (Instagram, Facebook, TikTok, YouTube, X, LinkedIn,
  Pinterest, Bluesky, Threads).
- **Social accounts:** `list_social_accounts`, `get_social_account`, `create_social_account`,
  `update_social_account`, `create_auth_url` (OAuth), `disconnect_social_account`,
  `list_account_feeds` (analytics).
- **Posts:** `create_post`, `publish_now`, `schedule_post`, `create_draft`, `get_post`,
  `list_posts`, `update_post`, `reschedule_post`, `delete_post` — with `platform_configurations`
  and `account_configurations` for per-platform / per-account tuning.
- **Analytics:** `list_post_results`, `get_post_result` (per-platform publish outcomes).
- **Previews:** `create_post_preview` (non-mutating, usable in readonly mode).
- **Media:** `create_media_upload_url` and one-step `upload_media` (local file or remote URL).
- **Webhooks:** `list_webhooks`, `get_webhook`, `create_webhook`, `update_webhook`, `delete_webhook`.
- Resilient client: Bearer auth, retries on 429/5xx with backoff + jitter, actionable errors.
- Safety: `POSTFORME_READONLY` mode, optional `POSTFORME_DISABLE_RAW`, configurable timeouts/retries.
- Companion skill `/postforme` (modes: post, schedule, campaign, analytics, accounts, media).

### Security
- SSRF hardening in `upload_media`: DNS resolution + per-IP public-unicast validation
  (`ipaddr.js`), redirects disabled, 256 MB size cap — blocks DNS rebinding, cloud-metadata
  endpoints and alternative IP encodings.
- Arbitrary-file-read mitigation in `upload_media`: media-extension allowlist, size cap, and
  optional `POSTFORME_MEDIA_DIR` directory restriction.
- `assertSafeRawPath` guards `postforme_raw` against path traversal / host swap (requires `/v1`).
- Webhook URLs validated as `https://` locally.
