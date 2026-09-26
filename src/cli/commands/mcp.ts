import chalk from "chalk";
import { StateStore } from "../../core/state-store.js";
import { serveMcp } from "../../mcp/server.js";
import { emitOk } from "../output.js";

interface McpOptions {
  json?: boolean;
}

export async function mcpServe(
  store: StateStore,
  options: McpOptions = {},
): Promise<void> {
  if (options.json) {
    emitOk(
      options.json,
      {
        mode: "stdio",
        message: "MCP server starting on stdio",
      },
      () => undefined,
    );
  } else {
    console.error(chalk.gray("Sandman MCP server listening on stdio"));
  }
  await serveMcp(store);
}
