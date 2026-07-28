import http from "node:http";

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  if (req.method === "GET" && req.url === "/v1/models") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ object: "list", data: [] }));
    return;
  }

  if (req.method === "POST" && req.url === "/v1/chat/completions") {
    req.resume();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        id: "chatcmpl-ci",
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: "ci-mock",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "ci mock response" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    );
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(4010, "0.0.0.0", () => {
  console.log("openai mock listening on 0.0.0.0:4010");
});
