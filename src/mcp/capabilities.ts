import { promises as fs } from "fs";
import { homedir } from "os";
import { join } from "path";

export type McpCapability = "read" | "provision" | "destroy";

export interface McpConfig {
  allow: McpCapability[];
}

const DEFAULT_CONFIG: McpConfig = {
  allow: ["read", "provision", "destroy"],
};

function configPath(): string {
  return join(homedir(), ".sandman", "mcp.toml");
}

export async function loadMcpConfig(): Promise<McpConfig> {
  try {
    const content = await fs.readFile(configPath(), "utf-8");
    const allow: McpCapability[] = [];
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("allow =")) {
        const match = trimmed.match(/\[(.*)\]/);
        if (match?.[1]) {
          for (const item of match[1].split(",")) {
            const cap = item.trim().replace(/"/g, "") as McpCapability;
            if (cap === "read" || cap === "provision" || cap === "destroy") {
              allow.push(cap);
            }
          }
        }
      }
    }
    return allow.length ? { allow } : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function hasCapability(
  config: McpConfig,
  capability: McpCapability,
): boolean {
  return config.allow.includes(capability);
}
