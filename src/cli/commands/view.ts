import http from "http";
import chalk from "chalk";
import { StateStore } from "../../core/state-store.js";
import {
  calculateRunningCost,
  formatCost,
  formatHourlyRate,
} from "../../utils/cost-estimator.js";
import { emitErr, emitOk } from "../output.js";
import { isExpired } from "../../utils/ttl.js";

interface ViewOptions {
  json?: boolean;
  host?: string;
  port?: number;
  allowRemote?: boolean;
}

function isLoopback(host: string): boolean {
  return host === "127.0.0.1" || host === "::1" || host === "localhost";
}

function renderHtml(
  environments: Awaited<ReturnType<StateStore["listEnvironments"]>>,
): string {
  const rows = environments
    .map((env) => {
      const cost = calculateRunningCost(env.provider, env.services, env.createdAt);
      const expired = env.expiresAt ? isExpired(env) : false;
      return `<tr>
        <td>${env.name}</td>
        <td>${env.provider}</td>
        <td>${env.status}</td>
        <td>${env.services.join(", ") || "—"}</td>
        <td>${env.expiresAt ?? "—"}${expired ? " (expired)" : ""}</td>
        <td>${formatHourlyRate(cost.hourlyRate)} / ${formatCost(cost.totalCost)}</td>
      </tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Sandman Viewer</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #111; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border-bottom: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f6f6f6; }
    .note { color: #666; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <h1>Sandman environments</h1>
  <p class="note">Read-only viewer. Credentials are never shown here.</p>
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Provider</th>
        <th>Status</th>
        <th>Services</th>
        <th>Expires</th>
        <th>Cost</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="6">No environments</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;
}

export async function viewEnvironments(
  store: StateStore,
  options: ViewOptions = {},
): Promise<void> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 9420;

  if (!isLoopback(host) && !options.allowRemote) {
    emitErr(options.json, {
      code: "INVALID_INPUT",
      error: `Refusing to bind ${host} without --allow-remote.`,
      hint: "The viewer serves with the operator's authority.",
    });
  }

  const server = http.createServer(async (_req, res) => {
    const environments = await store.listEnvironments();
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderHtml(environments));
  });

  await new Promise<void>((resolve) => {
    server.listen(port, host, resolve);
  });

  const url = `http://${host}:${port}`;
  emitOk(
    options.json,
    { url, host, port, readOnly: true },
    () => {
      console.log(chalk.green(`Sandman viewer running at ${url}`));
      console.log(chalk.gray("Press Ctrl+C to stop."));
    },
  );
}
