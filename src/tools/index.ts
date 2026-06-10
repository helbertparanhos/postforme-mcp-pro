import { AnyToolDef } from "../types.js";
import { accountTools } from "./accounts.js";
import { postTools } from "./posts.js";
import { resultTools } from "./results.js";
import { previewTools } from "./previews.js";
import { mediaTools } from "./media.js";
import { webhookTools } from "./webhooks.js";
import { rawTool } from "./raw.js";

/** Every typed tool, in a stable order, excluding postforme_raw (added conditionally). */
export const allTools: AnyToolDef[] = [
  ...accountTools,
  ...postTools,
  ...resultTools,
  ...previewTools,
  ...mediaTools,
  ...webhookTools,
];

export { rawTool };
