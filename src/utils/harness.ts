import { existsSync } from "fs";

export const SUPPORTED_HARNESSES = ["cursor", "codex", "opencode"] as const;

export type HarnessName = (typeof SUPPORTED_HARNESSES)[number];

export function parseHarness(value: string): HarnessName | undefined {
  const normalized = value.toLowerCase();
  return SUPPORTED_HARNESSES.find((h) => h === normalized);
}

export interface HarnessDetection {
  harness: HarnessName;
  installed: boolean;
  configPath?: string;
}

export function detectHarnesses(): HarnessDetection[] {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const candidates: Array<{ harness: HarnessName; paths: string[] }> = [
    {
      harness: "cursor",
      paths: [`${home}/.cursor/mcp.json`, `${home}/.cursor/mcp.jsonc`],
    },
    {
      harness: "codex",
      paths: [`${home}/.codex/config.toml`],
    },
    {
      harness: "opencode",
      paths: [
        `${home}/.config/opencode/opencode.json`,
        `${home}/.local/share/opencode/opencode.json`,
      ],
    },
  ];

  return candidates.map(({ harness, paths }) => {
    const found = paths.find((p) => existsSync(p));
    return {
      harness,
      installed: Boolean(found),
      configPath: found,
    };
  });
}
