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
}
