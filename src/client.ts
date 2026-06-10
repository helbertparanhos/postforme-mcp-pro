import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from "axios";

export interface PostForMeClientOptions {
  apiKey: string;
  /** Override the API base URL (for self-hosted / open-source deployments). */
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

const DEFAULT_BASE = "https://api.postforme.dev";

export interface RequestOptions {
  params?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, string>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Thin, resilient Post for Me REST client.
 *
 * Every endpoint lives under the /v1 prefix, so callers pass the FULL path
 * INCLUDING the version segment (e.g. "/v1/social-posts"). Authentication is a
 * Bearer API key. Errors are normalized into actionable messages.
 *
 * - Retries on 429 (respecting Retry-After) and transient 5xx / network errors.
 * - Exponential backoff with jitter.
 */
export class PostForMeClient {
  private http: AxiosInstance;
  private maxRetries: number;
  readonly baseUrl: string;

  constructor(opts: PostForMeClientOptions) {
    if (!opts.apiKey) {
      throw new Error(
        "POSTFORME_API_KEY is required. Create one in the Post for Me dashboard (Settings → API Keys)."
      );
    }
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE).replace(/\/+$/, "");
    this.maxRetries = opts.maxRetries ?? 3;
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: opts.timeoutMs ?? 60000,
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      // We handle non-2xx ourselves to craft good messages.
      validateStatus: () => true,
    });
  }

  async request<T = any>(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    path: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const url = path.startsWith("/") ? path : `/${path}`;

    const config: AxiosRequestConfig = {
      method,
      url,
      params: options.params,
    };
    if (options.body !== undefined) config.data = options.body;
    if (options.headers) config.headers = options.headers;

    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      let res;
      try {
        res = await this.http.request<T>(config);
      } catch (err) {
        if (attempt < this.maxRetries) {
          await sleep(this.backoff(attempt));
          attempt++;
          continue;
        }
        const e = err as AxiosError;
        throw new Error(`Network error calling Post for Me ${method} ${path}: ${e.message}`);
      }

      if (res.status === 429 && attempt < this.maxRetries) {
        const retryAfter = Number(res.headers["retry-after"]);
        const wait = Number.isFinite(retryAfter) ? retryAfter * 1000 : this.backoff(attempt);
        await sleep(wait);
        attempt++;
        continue;
      }

      if (res.status >= 500 && attempt < this.maxRetries) {
        await sleep(this.backoff(attempt));
        attempt++;
        continue;
      }

      if (res.status >= 400) {
        throw new Error(this.formatError(method, path, res.status, res.data));
      }

      return res.data as T;
    }
  }

  private backoff(attempt: number): number {
    return Math.min(8000, 500 * 2 ** attempt) + Math.floor(Math.random() * 250);
  }

  private formatError(method: string, path: string, status: number, data: any): string {
    let detail = "";
    // Post for Me errors are typically shaped { error: { message, code } } or
    // { message, errors: [...] }. Normalize the common shapes.
    const err = data?.error ?? data;
    if (err && typeof err === "object") {
      const code = err.code ? ` (code: ${err.code})` : "";
      if (err.message) {
        detail = `${err.message}${code}`;
      } else if (Array.isArray(err.errors)) {
        detail = err.errors
          .map((e: any) => (typeof e === "string" ? e : e?.message ?? JSON.stringify(e)))
          .join("; ");
      } else {
        detail = JSON.stringify(err);
      }
    } else if (typeof data === "string") {
      detail = data;
    }
    const hints: Record<number, string> = {
      400: "Bad request — check your parameters against the Post for Me API reference (https://api.postforme.dev/docs).",
      401: "Check that POSTFORME_API_KEY is valid and not revoked.",
      403: "Your API key lacks permission for this resource.",
      404: "Resource not found — verify the id and that your key can see it.",
      422: "Validation failed — check required fields (e.g. social_accounts, caption, platform_configurations).",
      429: "Rate limited by Post for Me. Reduce request volume or retry later.",
    };
    const hint = hints[status] ? ` Hint: ${hints[status]}` : "";
    return `Post for Me API ${method} ${path} failed (HTTP ${status}): ${detail}.${hint}`;
  }

  // ── Convenience verbs ────────────────────────────────────────────────────
  get<T = any>(path: string, options?: RequestOptions) {
    return this.request<T>("GET", path, options);
  }
  post<T = any>(path: string, options?: RequestOptions) {
    return this.request<T>("POST", path, options);
  }
  put<T = any>(path: string, options?: RequestOptions) {
    return this.request<T>("PUT", path, options);
  }
  patch<T = any>(path: string, options?: RequestOptions) {
    return this.request<T>("PATCH", path, options);
  }
  del<T = any>(path: string, options?: RequestOptions) {
    return this.request<T>("DELETE", path, options);
  }

  /**
   * Upload bytes to a signed URL returned by create-upload-url. This targets an
   * arbitrary storage host (not the API), so it uses a bare axios call with no
   * Authorization header.
   */
  async uploadToSignedUrl(
    signedUrl: string,
    data: Buffer | Uint8Array,
    contentType: string
  ): Promise<void> {
    const res = await axios.put(signedUrl, data, {
      headers: { "Content-Type": contentType },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      validateStatus: () => true,
    });
    if (res.status >= 400) {
      throw new Error(
        `Failed to upload media to signed URL (HTTP ${res.status}). The URL may have expired — generate a new one with create_media_upload_url.`
      );
    }
  }
}
