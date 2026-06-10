/**
 * Sanitize a raw API path for the postforme_raw escape hatch. Must be a clean
 * path on the Post for Me API host — no scheme, no host, no traversal. The
 * version segment is part of the path (e.g. "/v1/social-posts").
 */
export function assertSafeRawPath(path: string): void {
  if (typeof path !== "string" || path.length === 0) {
    throw new Error("path is required.");
  }
  if (!path.startsWith("/")) {
    throw new Error('path must start with "/" (e.g. "/v1/social-posts").');
  }
  if (path.startsWith("//")) {
    throw new Error('path must not start with "//".');
  }
  if (path.includes("://")) {
    throw new Error("path must be a relative API path, not a full URL.");
  }
  if (path.includes("..")) {
    throw new Error('path must not contain ".." (path traversal).');
  }
  if (path.includes("@")) {
    throw new Error('path must not contain "@".');
  }
  if (path.includes("\\")) {
    throw new Error("path must not contain backslashes.");
  }
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(path)) {
    throw new Error("path must not contain control characters.");
  }
  // Defense in depth: every Post for Me REST endpoint is versioned (/v1/...).
  // Require the first segment to be a version, so the escape hatch can only
  // ever target the documented API surface.
  if (!/^\/v\d+(\/|$|\?)/.test(path)) {
    throw new Error(
      'path must begin with a version segment, e.g. "/v1/social-posts" or "/v1/social-accounts/acc_xxx".'
    );
  }
}

import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";

/**
 * Assert that a resolved IP literal is a public, internet-routable unicast
 * address. Rejects loopback, private (RFC1918), link-local, CGNAT, reserved,
 * broadcast and IPv6 ULA/loopback — including IPv4-mapped IPv6 (::ffff:a.b.c.d)
 * and alternative encodings (decimal/octal parse to the same address).
 */
function assertPublicIp(ip: string): void {
  let addr: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    addr = ipaddr.parse(ip);
  } catch {
    throw new Error(`Could not parse resolved IP "${ip}".`);
  }
  // Collapse IPv4-mapped IPv6 (::ffff:127.0.0.1) down to the embedded IPv4.
  if (addr.kind() === "ipv6" && (addr as ipaddr.IPv6).isIPv4MappedAddress()) {
    addr = (addr as ipaddr.IPv6).toIPv4Address();
  }
  const range = addr.range();
  if (range !== "unicast") {
    throw new Error(
      `Refusing to fetch media from a non-public address (${ip}, range=${range}). ` +
        `Use a publicly reachable URL or a local file path.`
    );
  }
}

/**
 * Validate that an HTTP(S) URL is safe to fetch for upload_media. Beyond format
 * checks, this RESOLVES the hostname and verifies every A/AAAA record is a
 * public unicast IP — defending against SSRF via DNS rebinding, internal
 * hostnames, cloud metadata endpoints (169.254.169.254) and alternative IP
 * encodings. Returns the parsed URL. NOTE: callers must also disable HTTP
 * redirects (maxRedirects: 0), since a 3xx hop would bypass this check.
 */
export async function assertSafeRemoteUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid URL: ${raw}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http(s) URLs are supported for remote media.");
  }
  // Strip IPv6 brackets from the hostname for literal-IP detection.
  const host = url.hostname.replace(/^\[/, "").replace(/\]$/, "");
  if (ipaddr.isValid(host)) {
    // Literal IP in the URL — validate it directly (no DNS).
    assertPublicIp(host);
  } else {
    const records = await lookup(host, { all: true });
    if (!records.length) {
      throw new Error(`Could not resolve host "${host}".`);
    }
    for (const r of records) {
      assertPublicIp(r.address);
    }
  }
  return url;
}

/** Hard cap on bytes pulled/uploaded by upload_media, to avoid memory DoS. */
export const MAX_MEDIA_BYTES = 256 * 1024 * 1024; // 256 MB
