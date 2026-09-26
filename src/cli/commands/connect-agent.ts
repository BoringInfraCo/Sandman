import { promises as fs } from "fs";
import { dirname } from "path";
import chalk from "chalk";
import { StateStore } from "../../core/state-store.js";
import { parseHarness } from "../../utils/harness.js";
import { emitErr, emitOk } from "../output.js";

interface ConnectAgentOptions {
  json?: boolean;
  harness: string;
  config?: string;
}

function defaultConfigPath(harness: string): string {
  const home = process.env.HOME || "";
  switch (harness) {
    case "cursor":
      return `${home}/.cursor/mcp.json`;
    case "codex":
      return `${home}/.codex/config.toml`;
    case "opencode":
      return `${home}/.config/opencode/opencode.json`;
    default:
      return `${home}/.sandman/${harness}-mcp.json`;
  }
}

function mcpEntry() {
  return {
    command: "sandman",
    args: ["mcp", "serve"],
    env: {},
  };
}

async function writeCursorConfig(path: string): Promise<void> {
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(await fs.readFile(path, "utf-8")) as Record<
      string,
      unknown
    >;
  } catch {
    // new file
  }
  const servers =
    (existing.mcpServers as Record<string, unknown> | undefined) ?? {};
  servers.sandman = mcpEntry();
  existing.mcpServers = servers;
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, JSON.stringify(existing, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
}

async function writeOpenCodeConfig(path: string): Promise<void> {
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(await fs.readFile(path, "utf-8")) as Record<
      string,
      unknown
    >;
  } catch {
    // new file
  }
  const servers =
    (existing.mcp as Record<string, unknown> | undefined) ??
    (existing.mcpServers as Record<string, unknown> | undefined) ??
    {};
  servers.sandman = mcpEntry();
  existing.mcp = servers;
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, JSON.stringify(existing, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
}

async function writeCodexConfig(path: string): Promise<void> {
  const block = `
[mcp_servers.sandman]
command = "sandman"
args = ["mcp", "serve"]
`;
  let content = "";
  try {
    content = await fs.readFile(path, "utf-8");
  } catch {
    content = "";
  }
  if (!content.includes("[mcp_servers.sandman]")) {
    content = `${content.trim()}\n${block}`.trim() + "\n";
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(path, content, { encoding: "utf-8", mode: 0o600 });
  }
}

export async function connectAgent(
  _store: StateStore,
  options: ConnectAgentOptions,
): Promise<void> {
  const harness = parseHarness(options.harness);
  if (!harness) {
    emitErr(options.json, {
      code: "INVALID_INPUT",
      error: `Unknown harness "${options.harness}".`,
      hint: "Supported harnesses: cursor, codex, opencode",
    });
  }

  const configPath = options.config || defaultConfigPath(harness);
  if (harness === "cursor") {
    await writeCursorConfig(configPath);
  } else if (harness === "opencode") {
    await writeOpenCodeConfig(configPath);
  } else {
    await writeCodexConfig(configPath);
  }

  emitOk(
    options.json,
    {
      harness,
      configPath,
      nextAction: "Reload the harness so Sandman MCP tools appear.",
    },
    () => {
      console.log(chalk.green(`Wrote Sandman MCP entry for ${harness}.`));
      console.log(chalk.gray(`Config: ${configPath}`));
      console.log(chalk.cyan("Reload the harness to pick up the MCP server."));
    },
  );
}
