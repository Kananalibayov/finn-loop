import JSZip from "jszip";

const APP_ORIGIN = process.env.APP_ORIGIN ?? "http://localhost:3000";
const WP_ORIGIN = process.env.WP_ORIGIN ?? "http://localhost:8080";
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD;
const BUSINESS_NAME = "CI Smoke Studio";
const EXPECTED_PAGES = [
  ["home", "Home", "index.html"],
  ["services", "Services", "services.html"],
  ["gallery", "Gallery", "gallery.html"],
  ["contact", "Contact", "contact.html"],
  ["about", "About", "about.html"],
];

if (!WP_APP_PASSWORD) {
  throw new Error("WP_APP_PASSWORD is required");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function step(message) {
  console.log(`SMOKE ${message}`);
}

async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON from ${res.url}, got: ${text.slice(0, 200)}`);
  }
}

async function assertStatus(res, expected, label) {
  if (res.status === expected) return;
  const body = await res.text().catch(() => "");
  throw new Error(`${label} status ${res.status}: ${body.slice(0, 300)}`);
}

function cookieFrom(res) {
  const cookie = res.headers.get("set-cookie")?.split(";")[0] ?? "";
  assert(cookie.startsWith("admin_session="), "login did not set admin_session cookie");
  return cookie;
}

function countMatches(text, pattern) {
  return text.match(pattern)?.length ?? 0;
}

function assertGeneratedPage(page) {
  const html = String(page.html ?? "");
  assert(/^<!doctype/i.test(html), `${page.key} html does not start with <!doctype`);
  assert(countMatches(html, /<h1\b/gi) === 1, `${page.key} does not contain exactly one h1`);
  assert(/<\/html>\s*$/i.test(html), `${page.key} html does not end with </html>`);
  assert(html.includes(BUSINESS_NAME), `${page.key} html does not contain business name`);
  assert(!/lorem/i.test(html), `${page.key} html contains lorem`);
}

async function fetchApp(path, options = {}) {
  return fetch(`${APP_ORIGIN}${path}`, options);
}

function wpRest(path, params = {}) {
  const url = new URL(`${WP_ORIGIN}/index.php`);
  url.searchParams.set("rest_route", path);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function main() {
  step("1 login");
  const loginRes = await fetchApp("/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: "ci-throwaway-password" }),
  });
  await assertStatus(loginRes, 200, "login");
  const cookie = cookieFrom(loginRes);
  console.log("SMOKE login status=200 cookie=admin_session");

  const input = {
    businessName: BUSINESS_NAME,
    tagline: "Verifier first, confidence second",
    description: "A deterministic business used by the CI golden-path smoke test.",
    services: ["Generation", "WordPress push", "Read-back verification"],
    phone: "555-0100",
    email: "ci@example.test",
    address: "1 Smoke Test Way",
  };

  step("2 generate");
  const generateRes = await fetchApp("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ input, mode: "full", themeId: "minimal" }),
  });
  await assertStatus(generateRes, 200, "generate");
  const generated = await json(generateRes);
  assert(Number.isInteger(generated.id), "generate response missing persisted id");
  assert(Array.isArray(generated.pages), "generate response missing pages");
  assert(generated.pages.length === 5, `generate pages=${generated.pages.length}`);
  for (const page of generated.pages) assertGeneratedPage(page);
  console.log(`SMOKE generate project=${generated.id} pages=5 shape=ok`);

  step("3 create connection");
  const connectionRes = await fetchApp("/api/wp/connections", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      label: "CI WordPress",
      apiUrl: "http://wordpress/index.php?rest_route=",
      username: "admin",
      appPassword: WP_APP_PASSWORD,
    }),
  });
  await assertStatus(connectionRes, 201, "connection");
  const connection = await json(connectionRes);
  assert(Number.isInteger(connection.id), "connection response missing id");
  console.log(`SMOKE connection id=${connection.id}`);

  step("4 link project");
  const linkRes = await fetchApp(`/api/projects/${generated.id}/connection`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ connectionId: connection.id }),
  });
  await assertStatus(linkRes, 200, "link");
  console.log("SMOKE link status=200");

  step("5 push");
  const pushRes = await fetchApp(`/api/projects/${generated.id}/push-wp`, {
    method: "POST",
    headers: { cookie },
  });
  await assertStatus(pushRes, 200, "push");
  const push = await json(pushRes);
  const pageIds = Object.values(push.pageIds ?? {});
  assert(push.pushed === 5, `push pushed=${push.pushed}`);
  assert(pageIds.length === 5, `push pageIds count=${pageIds.length}`);
  assert(new Set(pageIds).size === 5, "push page ids are not distinct");
  console.log(`SMOKE push pushed=5 distinctPageIds=5`);

  step("6 wordpress read-back");
  const auth = Buffer.from(`admin:${WP_APP_PASSWORD}`).toString("base64");
  let readBackCount = 0;
  for (const [key, title] of EXPECTED_PAGES) {
    const slug = key;
    const url = wpRest("/wp/v2/pages", { slug, context: "edit", status: "any" });
    const readRes = await fetch(url, { headers: { authorization: `Basic ${auth}` } });
    await assertStatus(readRes, 200, `read-back ${slug}`);
    const rows = await json(readRes);
    assert(Array.isArray(rows), `read-back ${slug} was not an array`);
    assert(rows.length === 1, `read-back ${slug} rows=${rows.length}`);
    assert(rows[0]?.title?.rendered === title, `read-back ${slug} title=${rows[0]?.title?.rendered}`);
    assert(String(rows[0]?.content?.rendered ?? "").includes(BUSINESS_NAME), `read-back ${slug} missing business name`);
    readBackCount += 1;
    console.log(`SMOKE read-back ${slug}=ok wpId=${rows[0].id}`);
  }
  console.log(`SMOKE read-back verified=${readBackCount}/5`);

  const negativeRes = await fetch(wpRest("/wp/v2/pages", { slug: "never-pushed", context: "edit", status: "any" }), {
    headers: { authorization: `Basic ${auth}` },
  });
  await assertStatus(negativeRes, 200, "negative read-back");
  const negativeRows = await json(negativeRes);
  assert(Array.isArray(negativeRows) && negativeRows.length === 0, `never-pushed rows=${negativeRows.length}`);
  console.log("SMOKE read-back never-pushed=0");

  step("7 static zip");
  const zipRes = await fetchApp("/api/export/static-zip", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(generated.pages),
  });
  await assertStatus(zipRes, 200, "zip");
  const zip = await JSZip.loadAsync(Buffer.from(await zipRes.arrayBuffer()));
  const expectedFiles = new Set(EXPECTED_PAGES.map(([, , file]) => file));
  for (const file of expectedFiles) assert(zip.file(file), `zip missing ${file}`);
  let hrefCount = 0;
  for (const file of expectedFiles) {
    const html = await zip.file(file).async("string");
    for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
      const href = match[1];
      if (/^(https?:|mailto:|tel:|#)/i.test(href)) continue;
      const resolved = href.replace(/^\.\//, "");
      assert(expectedFiles.has(resolved), `${file} href ${href} does not resolve to a zip file`);
      hrefCount += 1;
    }
  }
  console.log(`SMOKE zip files=5 hrefsChecked=${hrefCount}`);
  console.log("SMOKE PASS");
}

main().catch((err) => {
  console.error(`SMOKE FAIL ${err.message}`);
  process.exit(1);
});
