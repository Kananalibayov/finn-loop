// Plesk REST API v2 client.
// Communicates with Plesk Obsidian's /api/v2/ endpoints to auto-provision
// WordPress sites for clients during onboarding.

export interface PleskConfig {
  pleskUrl: string; // e.g. https://silly-darwin.66-179-240-64.plesk.page:8443
  pleskUser: string; // admin or API token user
  pleskPassword: string; // password or API token
}

export interface PleskServerInfo {
  hostname: string;
  version: string;
}

export interface PleskSubscription {
  id: number;
  guid: string;
  name: string; // domain name
}

export interface PleskWpInstance {
  id: number;
  domain: string;
  url: string;
}

const TIMEOUT_MS = 30_000;
const USER_AGENT = "FinnLoopPlatform/1.0 (Plesk integration; agency auto-provisioning)";

/** Fetch wrapper for Plesk REST API v2. */
async function pleskFetch(
  config: PleskConfig,
  path: string,
  options: { method: string; body?: unknown } = { method: "GET" },
): Promise<Response> {
  const base = config.pleskUrl.replace(/\/+$/, "");
  const url = `${base}/api/v2${path}`;
  const basic = Buffer.from(`${config.pleskUser}:${config.pleskPassword}`).toString("base64");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    return await fetch(url, {
      method: options.method,
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Test the connection — calls GET /api/v2/server. */
export async function testPleskConnection(config: PleskConfig): Promise<PleskServerInfo> {
  const res = await pleskFetch(config, "/server");
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Plesk returned HTTP ${res.status}: ${body.substring(0, 200)}`);
  }
  const data = (await res.json()) as {
    hostname?: string;
    panel_version?: string;
    platform?: string;
  };
  return {
    hostname: data.hostname ?? "unknown",
    version: data.panel_version ?? "unknown",
  };
}

/** Create a new subscription (domain) in Plesk. */
export async function createSubscription(
  config: PleskConfig,
  input: { domain: string; adminEmail?: string },
): Promise<PleskSubscription> {
  const res = await pleskFetch(config, "/subscriptions", {
    method: "POST",
    body: {
      name: input.domain,
      // Use default service plan (empty = default).
      service_plan: {},
      properties: {
        ftp_login: `wp_${Math.random().toString(36).substring(2, 10)}`,
        ftp_password: generateTempPassword(),
      },
    },
  });

  if (!res.ok && res.status !== 201) {
    const body = await res.text();
    throw new Error(`Failed to create subscription for ${input.domain}: HTTP ${res.status}: ${body.substring(0, 300)}`);
  }

  const data = (await res.json()) as { id?: number; guid?: string; name?: string };
  return {
    id: data.id ?? 0,
    guid: data.guid ?? "",
    name: data.name ?? input.domain,
  };
}

/** Install WordPress on a domain via Plesk's WordPress Toolkit. */
export async function installWordPress(
  config: PleskConfig,
  input: { domain: string; adminEmail: string; title?: string },
): Promise<PleskWpInstance> {
  // Plesk REST API v2: POST /api/v2/wp-instances
  const res = await pleskFetch(config, "/wp-instances", {
    method: "POST",
    body: {
      domain: input.domain,
      admin_email: input.adminEmail,
      title: input.title ?? input.domain,
      locale: "en_US",
      version: "latest",
      admin_name: "admin",
      admin_password: generateTempPassword(),
      database: {
        // Let Plesk auto-create the DB.
      },
    },
  });

  if (!res.ok && res.status !== 201) {
    const body = await res.text();
    throw new Error(`Failed to install WordPress on ${input.domain}: HTTP ${res.status}: ${body.substring(0, 300)}`);
  }

  const data = (await res.json()) as { id?: number; domain?: string; url?: string };
  return {
    id: data.id ?? 0,
    domain: data.domain ?? input.domain,
    url: data.url ?? `https://${input.domain}`,
  };
}

/** Full provisioning: create subscription + install WP in one call. */
export async function provisionWpSite(
  config: PleskConfig,
  input: { domain: string; wpEmail: string; wpTitle?: string },
): Promise<{ subscription: PleskSubscription; wpInstance: PleskWpInstance }> {
  // Step 1: create the subscription (domain space).
  const subscription = await createSubscription(config, { domain: input.domain });

  // Step 2: install WordPress.
  const wpInstance = await installWordPress(config, {
    domain: input.domain,
    adminEmail: input.wpEmail,
    title: input.wpTitle,
  });

  return { subscription, wpInstance };
}

/** Generate a temporary password for WP admin / FTP. */
function generateTempPassword(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#";
  let pw = "";
  for (let i = 0; i < 16; i++) {
    pw += chars[Math.floor(Math.random() * chars.length)];
  }
  return pw;
}
