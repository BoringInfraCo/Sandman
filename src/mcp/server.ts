import readline from "readline";
import { StateStore } from "../core/state-store.js";
import { listEnvironments } from "../cli/commands/list.js";
import { statusEnvironment } from "../cli/commands/status.js";
import { createEnvironment } from "../cli/commands/create.js";
import { enableServices } from "../cli/commands/enable.js";
import { connectEnvironment } from "../cli/commands/connect.js";
import { destroyEnvironment } from "../cli/commands/destroy.js";
import { listProviders } from "../cli/commands/providers.js";
import { hasCapability, loadMcpConfig } from "./capabilities.js";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface ToolDefinition {
  name: string;
  description: string;
  capability: "read" | "provision" | "destroy";
  inputSchema: Record<string, unknown>;
}

const TOOLS: ToolDefinition[] = [
  {
    name: "list_environments",
    description: "List Sandman environments",
    capability: "read",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "providers",
    description: "Show provider capability matrix",
    capability: "read",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "status",
    description: "Show environment status",
    capability: "read",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
  },
  {
    name: "create",
    description: "Create a sandbox environment",
    capability: "provision",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        provider: { type: "string" },
        ttl: { type: "string" },
        template: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "enable",
    description: "Enable services in an environment",
    capability: "provision",
    inputSchema: {
      type: "object",
      properties: {
        environment: { type: "string" },
        services: { type: "array", items: { type: "string" } },
      },
      required: ["environment", "services"],
    },
  },
  {
    name: "connect",
    description: "Return environment credentials (redacted by default)",
    capability: "read",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        showSecrets: { type: "boolean" },
      },
      required: ["name"],
    },
  },
  {
    name: "destroy",
    description: "Destroy an environment",
    capability: "destroy",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        confirm: { type: "boolean" },
      },
      required: ["name", "confirm"],
    },
  },
];

function response(id: number | string | undefined, result: unknown) {
  return JSON.stringify({ jsonrpc: "2.0", id, result });
}

function errorResponse(
  id: number | string | undefined,
  code: number,
  message: string,
) {
  return JSON.stringify({
    jsonrpc: "2.0",
    id,
    error: { code, message },
  });
}

async function captureJson(fn: () => Promise<void>): Promise<unknown> {
  const lines: string[] = [];
  const original = console.log;
  console.log = (value?: unknown) => {
    lines.push(String(value));
  };
  try {
    await fn();
  } finally {
    console.log = original;
  }
  const last = lines[lines.length - 1];
  return last ? JSON.parse(last) : { success: true };
}

export async function serveMcp(store: StateStore): Promise<void> {
  const config = await loadMcpConfig();
  const rl = readline.createInterface({
    input: process.stdin,
    terminal: false,
  });

  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }
    let request: JsonRpcRequest;
    try {
      request = JSON.parse(line) as JsonRpcRequest;
    } catch {
      process.stdout.write(
        errorResponse(undefined, -32700, "Parse error") + "\n",
      );
      continue;
    }

    const { id, method, params = {} } = request;

    if (method === "initialize") {
      process.stdout.write(
        response(id, {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "sandman", version: "0.3.0" },
        }) + "\n",
      );
      continue;
    }

    if (method === "tools/list") {
      process.stdout.write(
        response(id, {
          tools: TOOLS.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          })),
        }) + "\n",
      );
      continue;
    }

    if (method === "tools/call") {
      const name = String(params.name ?? "");
      const args = (params.arguments ?? {}) as Record<string, unknown>;
      const tool = TOOLS.find((item) => item.name === name);
      if (!tool) {
        process.stdout.write(
          errorResponse(id, -32601, `Unknown tool: ${name}`) + "\n",
        );
        continue;
      }
      if (!hasCapability(config, tool.capability)) {
        process.stdout.write(
          errorResponse(id, -32000, `Capability denied: ${tool.capability}`) +
            "\n",
        );
        continue;
      }

      try {
        let result: unknown;
        switch (name) {
          case "list_environments":
            result = await captureJson(() =>
              listEnvironments(store, { json: true }),
            );
            break;
          case "providers":
            result = await captureJson(() => listProviders({ json: true }));
            break;
          case "status":
            result = await captureJson(() =>
              statusEnvironment(String(args.name), store, { json: true }),
            );
            break;
          case "create":
            result = await captureJson(() =>
              createEnvironment(
                String(args.name),
                {
                  provider: args.provider ? String(args.provider) : undefined,
                  ttl: args.ttl ? String(args.ttl) : undefined,
                  template: args.template ? String(args.template) : undefined,
                },
                store,
                { json: true, strict: true },
              ),
            );
            break;
          case "enable":
            result = await captureJson(() =>
              enableServices(
                (args.services as string[]) ?? [],
                String(args.environment),
                store,
                { json: true },
              ),
            );
            break;
          case "connect":
            result = await captureJson(() =>
              connectEnvironment(String(args.name), store, {
                json: true,
                showSecrets: Boolean(args.showSecrets),
              }),
            );
            break;
          case "destroy":
            if (!args.confirm) {
              process.stdout.write(
                errorResponse(
                  id,
                  -32000,
                  "destroy requires confirm: true",
                ) + "\n",
              );
              continue;
            }
            result = await captureJson(() =>
              destroyEnvironment(String(args.name), store, {
                confirmed: true,
                json: true,
              }),
            );
            break;
          default:
            process.stdout.write(
              errorResponse(id, -32601, `Unhandled tool: ${name}`) + "\n",
            );
            continue;
        }
        process.stdout.write(
          response(id, {
            content: [{ type: "text", text: JSON.stringify(result) }],
          }) + "\n",
        );
      } catch (error: unknown) {
        process.stdout.write(
          errorResponse(
            id,
            -32000,
            error instanceof Error ? error.message : String(error),
          ) + "\n",
        );
      }
      continue;
    }

    process.stdout.write(
      errorResponse(id, -32601, `Method not found: ${method}`) + "\n",
    );
  }
}
