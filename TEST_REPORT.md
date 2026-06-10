# Test Report — postforme-mcp-pro v1.0.0

**Date:** 2026-06-10
**Environment:** Node 22 · Windows 11
**Server:** `node dist/index.js`
**Account:** real Post for Me workspace (31 connected accounts across Threads/YouTube/Facebook/Instagram/LinkedIn/TikTok)

Read tools and non-destructive writes were exercised live against the real API. Tools that
post to / mutate / delete real social accounts were **not** fired against production (to avoid
publishing real content); they are marked *validated by review* — their request construction was
verified against the live API response shapes and the code review.

## Results

| Tool | Status | Notes |
|------|--------|-------|
| `list_social_accounts` | ✅ OK | 31 accounts returned (`{ data, meta }`), `spc_` ids |
| `get_social_account` | ✅ OK | resolves by id |
| `list_posts` | ✅ OK | returns posts with platform/account_configurations |
| `get_post` | ✅ OK | by id |
| `list_post_results` | ✅ OK | 26 results (success/error/platform_data) |
| `get_post_result` | ✅ OK | by id |
| `list_account_feeds` | ✅ OK | analytics feed with platform_url, posted_at, metrics |
| `create_media_upload_url` | ✅ OK | returns `{ upload_url, media_url }` |
| `upload_media` | ✅ OK | signed-URL extraction + PUT path verified; SSRF guard unit-tested (6 bypass vectors blocked) |
| `list_webhooks` | ✅ OK | empty list returned cleanly |
| `get_webhook` | ✅ OK | by id |
| `create_post` | 🟦 Validated by review | not published to real accounts |
| `publish_now` | 🟦 Validated by review | not published to real accounts |
| `schedule_post` | 🟦 Validated by review | not published to real accounts |
| `create_draft` | 🟦 Validated by review | not published to real accounts |
| `update_post` | 🟦 Validated by review | mutates real posts |
| `reschedule_post` | 🟦 Validated by review | mutates real posts |
| `delete_post` | 🟦 Validated by review | destructive |
| `create_post_preview` | 🟦 Validated by review | POST; non-mutating |
| `create_social_account` | 🟦 Validated by review | mutates connections |
| `update_social_account` | 🟦 Validated by review | mutates connections |
| `create_auth_url` | 🟦 Validated by review | starts OAuth flow |
| `disconnect_social_account` | 🟦 Validated by review | destructive |
| `create_webhook` | 🟦 Validated by review | mutates config |
| `update_webhook` | 🟦 Validated by review | mutates config |
| `delete_webhook` | 🟦 Validated by review | destructive |
| `postforme_raw` | ✅ OK | used to drive the read calls above |

## Summary

- **Total:** 27 tools
- **Tested live (OK):** 11 (all reads + media upload-url + raw)
- **Validated by review:** 16 (writes/destructive against real social accounts)
- **Errors:** 0

## Notes

- Auth (Bearer) confirmed working against `https://api.postforme.dev`.
- List endpoints are paginated as `{ data, meta }`.
- SSRF hardening in `upload_media` unit-tested: cloud-metadata (169.254.169.254), loopback,
  decimal/IPv4-mapped encodings and RFC1918 all blocked; public URL passes.
- Readonly mode (`POSTFORME_READONLY=true`) blocks all 17 write tools; `postforme_raw` GET still allowed.
