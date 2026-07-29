import http from "node:http";

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function businessNameFromRequest(body) {
  try {
    const parsed = JSON.parse(body);
    const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
    const user = [...messages].reverse().find((message) => message?.role === "user");
    const content = typeof user?.content === "string" ? user.content : "";
    const match = content.match(/Business name:\s*(.+)/i);
    return match?.[1]?.split("\n")[0]?.trim() || "CI Smoke Studio";
  } catch (err) {
    console.error(`mock request parse failed: ${err.message}`);
    return "CI Smoke Studio";
  }
}

function htmlForBusiness(businessName) {
  const escaped = businessName
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escaped}</title>
</head>
<body>
  <header>
    <nav aria-label="Primary">
      <a href="index.html">Home</a>
      <a href="services.html">Services</a>
      <a href="gallery.html">Gallery</a>
      <a href="contact.html">Contact</a>
      <a href="about.html">About</a>
    </nav>
  </header>
  <main>
    <h1>${escaped}</h1>
    <p>${escaped} provides reliable CI smoke-test fixtures for the Finn-loop verifier.</p>
  </main>
  <footer>Contact ${escaped} today.</footer>
</body>
`;
}

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  if (req.method === "GET" && req.url === "/v1/models") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ object: "list", data: [] }));
    return;
  }

  if (req.method === "POST" && req.url === "/v1/chat/completions") {
    readBody(req)
      .then((body) => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            id: "chatcmpl-ci",
            object: "chat.completion",
            created: 0,
            model: "ci-mock",
            choices: [
              {
                index: 0,
                message: { role: "assistant", content: htmlForBusiness(businessNameFromRequest(body)) },
                finish_reason: "stop",
              },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          }),
        );
      })
      .catch((err) => {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      });
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(4010, "0.0.0.0", () => {
  console.log("openai mock listening on 0.0.0.0:4010");
});
