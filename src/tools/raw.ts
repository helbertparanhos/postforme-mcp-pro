import { z } from "zod";
import { defineTool } from "../types.js";
import { assertSafeRawPath } from "../security.js";

/**
 * Escape hatch: call ANY Post for Me REST endpoint not covered by a typed tool.
 * Guarantees 100% API coverage even for niche or brand-new endpoints.
 */
export const rawTool = defineTool({
  name: "postforme_raw",
  description:
    "Call any Post for Me REST endpoint directly (escape hatch for full API coverage). " +
    "Provide the HTTP method and the FULL path INCLUDING the version segment " +
    "(e.g. '/v1/social-posts' or '/v1/social-accounts/acc_xxx'), plus optional query params and JSON body. " +
    "Use this only when no dedicated tool exists. Auth, retries and rate-limiting are handled for you. " +
    "Reference: https://api.postforme.dev/docs",
  // Treated as a write so it's blocked in readonly mode unless method is GET (checked in handler).
  write: true,
  schema: z.object({
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).describe("HTTP method."),
    path: z
      .string()
      .describe("Full path including version, starting with '/'. Example: '/v1/social-posts'."),
    params: z.record(z.any()).optional().describe("Query string parameters."),
    body: z.any().optional().describe("Request body (for POST/PUT/PATCH)."),
  }),
  handler: async (args, client) => {
    assertSafeRawPath(args.path);
    return client.request(args.method, args.path, {
      params: args.params,
      body: args.body,
    });
  },
});

/** postforme_raw GET calls should be allowed even in readonly mode. */
export function isRawReadOnly(args: unknown): boolean {
  return (
    typeof args === "object" &&
    args !== null &&
    (args as { method?: string }).method === "GET"
  );
}
