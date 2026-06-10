import { z } from "zod";
import { defineTool, limitParam, offsetParam } from "../types.js";

/**
 * Webhooks: subscribe an HTTPS endpoint to Post for Me events (e.g. a post
 * finished publishing, or a publish failed) so your systems react in real time.
 */
export const webhookTools = [
  defineTool({
    name: "list_webhooks",
    description: "List the webhooks configured in your workspace.",
    schema: z.object({
      limit: limitParam,
      offset: offsetParam,
    }),
    handler: async (args, client) => {
      const params: Record<string, unknown> = {};
      if (args.limit !== undefined) params.limit = args.limit;
      if (args.offset !== undefined) params.offset = args.offset;
      return client.get(`/v1/webhooks`, { params });
    },
  }),

  defineTool({
    name: "get_webhook",
    description: "Get a single webhook by id.",
    schema: z.object({
      id: z.string().describe("Webhook id."),
    }),
    handler: async (args, client) => {
      return client.get(`/v1/webhooks/${encodeURIComponent(args.id)}`);
    },
  }),

  defineTool({
    name: "create_webhook",
    description:
      "Create a webhook that POSTs to your HTTPS endpoint when the chosen events occur (e.g. post published, " +
      "post errored). Subscribe to specific event types or all of them.",
    write: true,
    schema: z.object({
      url: z
        .string()
        .url()
        .refine((u) => u.startsWith("https://"), { message: "Webhook URL must use https://." })
        .describe("HTTPS endpoint that will receive event payloads."),
      event_types: z
        .array(z.string())
        .optional()
        .describe(
          "Event types to subscribe to (e.g. 'social.post.created', 'social.post.updated', " +
            "'social.post.result.created'). Omit to receive all events."
        ),
    }),
    handler: async (args, client) => {
      const body: Record<string, unknown> = { url: args.url };
      if (args.event_types) body.event_types = args.event_types;
      return client.post(`/v1/webhooks`, { body });
    },
  }),

  defineTool({
    name: "update_webhook",
    description: "Update a webhook's URL or subscribed event types.",
    write: true,
    schema: z.object({
      id: z.string().describe("Webhook id to update."),
      url: z
        .string()
        .url()
        .refine((u) => u.startsWith("https://"), { message: "Webhook URL must use https://." })
        .optional()
        .describe("New HTTPS endpoint."),
      event_types: z
        .array(z.string())
        .optional()
        .describe("New set of event types to subscribe to."),
    }),
    handler: async (args, client) => {
      const { id, ...body } = args;
      return client.patch(`/v1/webhooks/${encodeURIComponent(id)}`, { body });
    },
  }),

  defineTool({
    name: "delete_webhook",
    description: "Delete a webhook by id.",
    write: true,
    schema: z.object({
      id: z.string().describe("Webhook id to delete."),
    }),
    handler: async (args, client) => {
      await client.del(`/v1/webhooks/${encodeURIComponent(args.id)}`);
      return { deleted: true, id: args.id };
    },
  }),
];
