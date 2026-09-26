import { promises as fs } from "fs";
import { dirname, join } from "path";
import { homedir } from "os";
import type { EnvironmentRecord } from "../types/index.js";

export interface CheckpointRecord {
  id: string;
  environmentName: string;
  message?: string;
  createdAt: string;
  environment: EnvironmentRecord;
}

function checkpointsDir(configPath: string): string {
  const base = dirname(configPath);
  return join(base, "checkpoints");
}

function checkpointPath(configPath: string, envName: string): string {
  return join(checkpointsDir(configPath), `${envName}.json`);
}

export async function listCheckpoints(
  configPath: string,
  envName: string,
): Promise<CheckpointRecord[]> {
  try {
    const content = await fs.readFile(checkpointPath(configPath, envName), "utf-8");
    return JSON.parse(content) as CheckpointRecord[];
  } catch {
    return [];
  }
}

export async function saveCheckpoint(
  configPath: string,
  env: EnvironmentRecord,
  message?: string,
): Promise<CheckpointRecord> {
  const existing = await listCheckpoints(configPath, env.name);
  const record: CheckpointRecord = {
    id: `${env.name}-${String(existing.length + 1).padStart(4, "0")}`,
    environmentName: env.name,
    message,
    createdAt: new Date().toISOString(),
    environment: env,
  };
  const dir = checkpointsDir(configPath);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const next = [...existing, record];
  const path = checkpointPath(configPath, env.name);
  await fs.writeFile(path, JSON.stringify(next, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
  return record;
}

export async function latestCheckpoint(
  configPath: string,
  envName: string,
): Promise<CheckpointRecord | undefined> {
  const items = await listCheckpoints(configPath, envName);
  return items[items.length - 1];
}

export function defaultSandmanHome(): string {
  return join(homedir(), ".sandman");
}
