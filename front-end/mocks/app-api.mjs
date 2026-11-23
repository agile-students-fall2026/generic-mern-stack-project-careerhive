import { readFileSync } from "node:fs";


const discussions = JSON.parse(
  readFileSync(new URL("./discussions.json", import.meta.url), "utf8"),
);

function send(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

function appMiddleware(request, response, next) {
  const path = new URL(request.url, "http://localhost").pathname;
  const known = [
    "/api/discussions",
  ];
  if (!known.some((item) => path === item || path.startsWith(item + "/")))
    return next();
  if (request.method !== "GET")
    return send(response, 405, { error: "Method not allowed" });

  if (path === "/api/discussions") return send(response, 200, discussions);
  if (path.startsWith("/api/discussions/")) {
    const jobId = decodeURIComponent(path.slice("/api/discussions/".length));
    return send(
      response,
      200,
      discussions.filter((item) => item.jobId === jobId),
    );
  }
  return send(response, 404, { error: "Not found" });
}

export default function appMockApi() {
  return {
    name: 'careerhive-app-mock-api',
    configureServer(server) {
      server.middlewares.use(appMiddleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(appMiddleware)
    },
  }
}
