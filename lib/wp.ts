// AC-1, AC-2, AC-3, AC-5, AC-6 (issue #23): WordPress REST API client.
// Authenticates via HTTP Basic Auth with a WP Application Password.
// `testConnection()` is the only method here — push/media/plugins come later.
//
// AC-5: the class is constructed lazily by callers; importing this module
// never makes a network call (matches lib/openai.ts + lib/db.ts patterns).

/** AC-1: credentials needed to talk to one WP instance. */
export interface WpCreds {
  /** WP REST API root, e.g. "https://site.example/wp-json" (no trailing slash). */
  apiUrl: string;
  /** WP username (e.g. the admin login). */
  username: string;
  /** WP Application Password (the spaces are fine — WP accepts both forms). */
  appPassword: string;
}

/** AC-3: result shape returned by testConnection(). Never throws. */
export type WpTestResult =
  | { ok: true; username: string; roles: string[] }
  | { ok: false; error: string };

/** Default request timeout (AC-6). */
const DEFAULT_TIMEOUT_MS = 10_000;

/** AC-6: descriptive User-Agent so requests are identifiable in WP logs. */
const USER_AGENT = "ai-website-generator/0.1";

/**
 * Shared internal request helper — builds the auth header, sets UA + timeout,
 * and returns the Response. Throws on network errors (callers wrap in try/catch).
 */
async function wpFetch(
  creds: WpCreds,
  path: string,
  options: { method: string; body?: Record<string, unknown>; timeoutMs: number },
): Promise<Response> {
  const base = creds.apiUrl.replace(/\/+$/, "");
  const url = `${base}${path}`;
  const basic = Buffer.from(
    `${creds.username}:${creds.appPassword}`,
  ).toString("base64");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const res = await fetch(url, {
      method: options.method,
      headers: {
        Authorization: `Basic ${basic}`,
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/** Shape of a WP page (post type=page) from the REST API. */
interface WpPage {
  id: number;
  slug: string;
  title: { rendered: string };
  status: string;
}

/**
 * AC-1: WP REST API client. One instance per WP target. Construct lazily
 * (callers create it when they have creds, not at module load time).
 */
export class WpClient {
  private readonly creds: WpCreds;
  private readonly timeoutMs: number;

  constructor(creds: WpCreds, timeoutMs: number = DEFAULT_TIMEOUT_MS) {
    this.creds = creds;
    this.timeoutMs = timeoutMs;
  }

  /**
   * AC-3: prove the credentials work by fetching the current user.
   * Calls GET <apiUrl>/wp/v2/users/me with Basic Auth. Returns a result
   * object — never throws — so API callers can surface errors as JSON.
   */
  async testConnection(): Promise<WpTestResult> {
    // Normalize the API URL: trim trailing slashes, ensure /wp-json suffix.
    const base = this.creds.apiUrl.replace(/\/+$/, "");
    const url = `${base}/wp/v2/users/me?context=edit`;

    // AC-2: HTTP Basic Auth header. Application Passwords use the WP username
    // (not an email) + the generated password.
    const basic = Buffer.from(
      `${this.creds.username}:${this.creds.appPassword}`,
    ).toString("base64");

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Basic ${basic}`,
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        // 401 = bad creds; 404 = wrong API URL; 5xx = WP-side problem.
        return { ok: false, error: `WordPress returned HTTP ${res.status}` };
      }

      const data = (await res.json()) as {
        username?: string;
        slug?: string;
        roles?: string[];
      };
      // WP returns username in `slug` (the login slug) under context=edit;
      // `username` may be present too depending on WP version. Be defensive.
      const username = data.username || data.slug || this.creds.username;
      const roles = Array.isArray(data.roles) ? data.roles : [];

      return { ok: true, username, roles };
    } catch (e) {
      // Network error, DNS failure, timeout (abort), or bad URL.
      const err = e as Error;
      if (err.name === "AbortError") {
        return { ok: false, error: `Request timed out after ${this.timeoutMs / 1000}s` };
      }
      return { ok: false, error: `Network error: ${err.message}` };
    }
  }

  // --- Phase 1 (issue #30): page push methods ---

  /**
   * AC-1: create a new WP page (post type=page). Returns the WP page ID.
   * Throws on failure — callers handle errors.
   */
  async createPage(input: {
    title: string;
    slug: string;
    content: string;
    status?: string;
  }): Promise<number> {
    const res = await wpFetch(this.creds, "/wp/v2/pages", {
      method: "POST",
      body: {
        title: input.title,
        slug: input.slug,
        status: input.status ?? "draft",
        content: input.content,
      },
      timeoutMs: this.timeoutMs,
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(`createPage failed (HTTP ${res.status}): ${errBody.message ?? res.statusText}`);
    }
    const page = (await res.json()) as WpPage;
    return page.id;
  }

  /**
   * AC-2: update an existing WP page by its ID. Returns the updated page.
   * Throws on failure.
   */
  async updatePage(wpPageId: number, input: {
    title?: string;
    content?: string;
  }): Promise<WpPage> {
    const res = await wpFetch(this.creds, `/wp/v2/pages/${wpPageId}`, {
      method: "POST",
      body: {
        ...(input.title ? { title: input.title } : {}),
        ...(input.content ? { content: input.content } : {}),
      },
      timeoutMs: this.timeoutMs,
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(`updatePage failed (HTTP ${res.status}): ${errBody.message ?? res.statusText}`);
    }
    return (await res.json()) as WpPage;
  }

  /**
   * AC-3: find a page ID by its slug. Returns the WP page ID, or null if no
   * page with that slug exists. Used on first push to prevent duplicates.
   */
  async getPageIdBySlug(slug: string): Promise<number | null> {
    const res = await wpFetch(
      this.creds,
      `/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=1`,
      { method: "GET", timeoutMs: this.timeoutMs },
    );
    if (!res.ok) {
      // If we can't check, return null (the caller will try to create).
      return null;
    }
    const pages = (await res.json()) as WpPage[];
    return pages.length > 0 ? pages[0].id : null;
  }
}
