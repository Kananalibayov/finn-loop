// SSRF guard for server-side fetches of caller-supplied URLs.
//
// Any route that fetches a URL a caller provided must call assertPublicHttpTarget
// first, and again for every redirect hop — resolving the hostname and rejecting
// loopback, private, link-local and CGNAT addresses. Checking the hostname string
// alone is not sufficient: an attacker-controlled DNS name can resolve to
// 127.0.0.1 or 169.254.169.254.

import { lookup } from "node:dns/promises";

export class UnsafeTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeTargetError";
  }
}

/** Parse a dotted-quad into its four octets, or null if it is not IPv4. */
function ipv4Octets(host: string): [number, number, number, number] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const parts = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  if (parts.some((p) => p > 255)) return null;
  return parts as [number, number, number, number];
}

/** True for any IPv4 address that must never be fetched from the server. */
function isBlockedIpv4(host: string): boolean {
  const o = ipv4Octets(host);
  if (!o) return false;
  const [a, b] = o;
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true; // private
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 IETF protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast + reserved
  return false;
}

/** True for any IPv6 address that must never be fetched from the server. */
function isBlockedIpv6(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "::" || h === "::1") return true; // unspecified, loopback

  // IPv4-mapped / IPv4-compatible — judge the embedded v4 address.
  // Two spellings reach us: the dotted form a caller typed (::ffff:10.0.0.1)
  // and the hex form the WHATWG URL parser normalises it to (::ffff:a00:1).
  const dotted = /^::(?:ffff:)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(h);
  if (dotted) return isBlockedIpv4(dotted[1]);
  const hex = /^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    const quad = `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
    return isBlockedIpv4(quad);
  }

  if (/^f[cd][0-9a-f]{2}:/.test(h)) return true; // fc00::/7 unique-local
  if (/^fe[89ab][0-9a-f]:/.test(h)) return true; // fe80::/10 link-local
  return false;
}

function isBlockedAddress(addr: string): boolean {
  return isBlockedIpv4(addr) || isBlockedIpv6(addr);
}

/**
 * Throw UnsafeTargetError unless `raw` is an http(s) URL whose hostname
 * resolves exclusively to public addresses. Returns the parsed URL.
 *
 * Call this before the initial fetch AND for every redirect Location.
 *
 * Note: this resolves DNS and then the fetch resolves it again, so a
 * determined attacker controlling a very low TTL record could still rebind
 * between the two lookups. Closing that requires pinning the resolved
 * address into the connection; tracked as a separate hardening task.
 */
export async function assertPublicHttpTarget(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeTargetError("Not a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeTargetError("Only http:// and https:// URLs are allowed.");
  }

  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new UnsafeTargetError("Refusing to fetch a loopback or internal hostname.");
  }

  // A literal IP needs no DNS lookup — judge it directly.
  if (isBlockedAddress(host)) {
    throw new UnsafeTargetError("Refusing to fetch a private or loopback address.");
  }

  // Hostname: resolve and reject if ANY answer is a blocked address.
  if (!ipv4Octets(host) && !host.includes(":")) {
    let addrs: Array<{ address: string }>;
    try {
      addrs = await lookup(host, { all: true });
    } catch {
      throw new UnsafeTargetError(`Could not resolve host "${host}".`);
    }
    if (addrs.length === 0) {
      throw new UnsafeTargetError(`Host "${host}" did not resolve.`);
    }
    for (const { address } of addrs) {
      if (isBlockedAddress(address)) {
        throw new UnsafeTargetError("Refusing to fetch a host that resolves to a private address.");
      }
    }
  }

  return url;
}
