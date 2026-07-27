// Plesk REST API v2 client.
// Uses node:https directly (not fetch) because Plesk uses self-signed certs
// and Node's fetch doesn't support rejectUnauthorized: false.

import https from "node:https";
import { URL } from "node:url";

export interface PleskConfig {
  pleskUrl: string;
  pleskUser: string;
  pleskPassword: string;
}

export interface PleskServerInfo {
  hostname: string;
  version: string;
}

export interface PleskSubscription {
  id: number;
  guid: string;
  name: string;
}

export interface PleskWpInstance {
  id: number;
  domain: string;
  url: string;
}

const TIMEOUT_MS = 30_000;

/** Low-level Plesk API call using https.request (supports self-signed certs). */
function pleskRequest(
  config: PleskConfig,
  path: string,
  options: { method: string; body?: unknown } = { method: "GET" },
): Promise<{ status: number; data: unknown; text: string }> {
  return new Promise((resolve, reject) => {
    const base = config.pleskUrl.replace(/\/+$/, "");
    const fullUrl = new URL(`${base}/api/v2${path}`);
    const basic = Buffer.from(`${config.pleskUser}:${config.pleskPassword}`).toString("base64");

    const reqOptions = {
      hostname: fullUrl.hostname,
      port: fullUrl.port || 8443,
      path: fullUrl.pathname + fullUrl.search,
      method: options.method,
      rejectUnauthorized: false,
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "FinnLoopPlatform/1.0",
        ...(options.body ? { "Content-Length": Buffer.byteLength(JSON.stringify(options.body)) } : {}),
      },
    };

    const req = https.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        let parsed: unknown = null;
        try { parsed = JSON.parse(data); } catch { /* not JSON */ }
        resolve({ status: res.statusCode ?? 0, data: parsed, text: data });
      });
    });

    req.on("error", (e) => reject(new Error(`Plesk request failed: ${e.message}`)));
    req.setTimeout(TIMEOUT_MS, () => { req.destroy(); reject(new Error("Plesk request timed out.")); });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

/** Test the connection — calls GET /api/v2/server. */
export async function testPleskConnection(config: PleskConfig): Promise<PleskServerInfo> {
  const res = await pleskRequest(config, "/server");
  if (res.status !== 200) {
    throw new Error(`Plesk returned HTTP ${res.status}: ${res.text.substring(0, 200)}`);
  }
  const data = res.data as { hostname?: string; panel_version?: string };
  return {
    hostname: data.hostname ?? "unknown",
    version: data.panel_version ?? "unknown",
  };
}

/** Create a new domain in Plesk (REST API v2: POST /api/v2/domains).
 *  Verified working against Plesk Obsidian 18.0.79. */
export async function createSubscription(
  config: PleskConfig,
  input: { domain: string; adminEmail?: string },
): Promise<PleskSubscription> {
  const ftpUser = `u${Math.random().toString(36).substring(2, 10)}`;
  const ftpPass = generateStrongPassword();
  const res = await pleskRequest(config, "/domains", {
    method: "POST",
    body: {
      name: input.domain,
      hosting_type: "virtual",
      hosting_settings: {
        ftp_login: ftpUser,
        ftp_password: ftpPass,
      },
    },
  });

  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`Failed to create domain ${input.domain}: HTTP ${res.status}: ${res.text.substring(0, 300)}`);
  }

  const data = res.data as { id?: number; guid?: string };
  return {
    id: data.id ?? 0,
    guid: data.guid ?? "",
    name: input.domain,
  };
}

/** Install WordPress — note: WP Toolkit REST API may not be available on all
 *  Plesk installations. This attempts the REST endpoint; if it fails, the
 *  domain is still created (createSubscription succeeded) and the operator
 *  can install WP via Plesk's UI (one click with WP Toolkit). */
export async function installWordPress(
  config: PleskConfig,
  input: { domain: string; adminEmail: string; title?: string },
): Promise<PleskWpInstance> {
  try {
    const res = await pleskRequest(config, "/wp-instances", {
      method: "POST",
      body: {
        domain: input.domain,
        admin_email: input.adminEmail,
        title: input.title ?? input.domain,
        locale: "en_US",
        version: "latest",
        admin_name: "admin",
        admin_password: generateStrongPassword(),
      },
    });

    if (res.status === 201 || res.status === 200) {
      const data = res.data as { id?: number; domain?: string; url?: string };
      return {
        id: data.id ?? 0,
        domain: data.domain ?? input.domain,
        url: data.url ?? `https://${input.domain}`,
      };
    }
  } catch {
    // WP Toolkit REST not available — fall through.
  }

  // Fallback: domain created, but WP install needs to be done via Plesk UI.
  return {
    id: 0,
    domain: input.domain,
    url: `https://${input.domain}`,
  };
}

/** Full provisioning: create subscription + install WP in one call. */
export async function provisionWpSite(
  config: PleskConfig,
  input: { domain: string; wpEmail: string; wpTitle?: string },
): Promise<{ subscription: PleskSubscription; wpInstance: PleskWpInstance }> {
  const subscription = await createSubscription(config, { domain: input.domain });
  const wpInstance = await installWordPress(config, {
    domain: input.domain,
    adminEmail: input.wpEmail,
    title: input.wpTitle,
  });
  return { subscription, wpInstance };
}

/** Generate a strong password that meets Plesk's "Strong" policy
 *  (uppercase + lowercase + digits + special chars, 16+ chars). */
function generateStrongPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%^&*";
  const all = upper + lower + digits + special;
  let pw = "";
  // Guarantee at least one of each type.
  pw += upper[Math.floor(Math.random() * upper.length)];
  pw += lower[Math.floor(Math.random() * lower.length)];
  pw += digits[Math.floor(Math.random() * digits.length)];
  pw += special[Math.floor(Math.random() * special.length)];
  for (let i = 0; i < 14; i++) {
    pw += all[Math.floor(Math.random() * all.length)];
  }
  // Shuffle.
  return pw.split("").sort(() => Math.random() - 0.5).join("");
}
