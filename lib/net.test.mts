// First test in this repo. Covers lib/net.ts, the SSRF guard — security-critical
// code where a single missed address range is a bypass.
//
// Run: npm test
//
// Note the mapped-IPv6 cases: the WHATWG URL parser normalises
// ::ffff:127.0.0.1 to ::ffff:7f00:1, so a guard that only matches the dotted
// spelling has a live bypass. That regression is what this file caught.

import { test } from "node:test";
import assert from "node:assert/strict";
import { assertPublicHttpTarget, UnsafeTargetError } from "./net.ts";

const MUST_REJECT: Array<[string, string]> = [
  ["private 10/8", "http://10.0.0.5:8080/wp-json"],
  ["private 10/8 upper", "http://10.255.255.254/"],
  ["loopback", "http://127.0.0.1:3000/wp-json"],
  ["loopback 127/8", "http://127.99.1.2/"],
  ["cloud metadata", "http://169.254.169.254/latest/meta-data/"],
  ["localhost name", "http://localhost:3000/wp-json"],
  ["localhost subdomain", "http://sub.localhost/"],
  ["private 172.16/12 low", "http://172.16.0.1/"],
  ["private 172.16/12 high", "http://172.31.255.255/"],
  ["private 192.168/16", "http://192.168.1.1/wp-json"],
  ["IETF 192.0.0/24", "http://192.0.0.1/"],
  ["CGNAT 100.64/10", "http://100.64.0.1/"],
  ["this-network 0/8", "http://0.0.0.0/"],
  ["multicast", "http://224.0.0.1/"],
  ["benchmarking 198.18/15", "http://198.18.0.1/"],
  ["ipv6 loopback", "http://[::1]/"],
  ["ipv4-mapped loopback (dotted)", "http://[::ffff:127.0.0.1]/"],
  ["ipv4-mapped private (dotted)", "http://[::ffff:10.0.0.1]/"],
  ["ipv4-mapped metadata (dotted)", "http://[::ffff:169.254.169.254]/"],
  ["ipv4-mapped private (hex)", "http://[::ffff:a00:1]/"],
  ["ipv6 unique-local", "http://[fc00::1]/"],
  ["ipv6 link-local", "http://[fe80::1]/"],
  ["ftp scheme", "ftp://example.com/"],
  ["file scheme", "file:///etc/passwd"],
  ["gopher scheme", "gopher://internal/"],
  ["not a url", "not a url"],
  [".internal tld", "http://svc.internal/"],
];

const MUST_ALLOW: Array<[string, string]> = [
  ["public https", "https://example.com/wp-json"],
  ["public http", "http://example.com/wp-json"],
  ["real client host", "https://floralwhite-crab-150803.hostingersite.com/wp-json"],
  ["public literal ip", "https://1.1.1.1/"],
];

for (const [name, url] of MUST_REJECT) {
  test(`rejects ${name}`, async () => {
    await assert.rejects(
      () => assertPublicHttpTarget(url),
      (e: unknown) => e instanceof UnsafeTargetError,
      `${url} should have been rejected as an unsafe target`,
    );
  });
}

for (const [name, url] of MUST_ALLOW) {
  test(`allows ${name}`, async () => {
    const parsed = await assertPublicHttpTarget(url);
    assert.ok(parsed instanceof URL);
  });
}
