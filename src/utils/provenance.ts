import { execFile } from "child_process";
import { promisify } from "util";
import type { EnvironmentProvenance } from "../types/index.js";

const execFileAsync = promisify(execFile);

export interface ProvenanceInput {
  harness?: string;
  actor?: string;
  sessionId?: string;
  goal?: string;
}

export async function resolveActor(explicit?: string): Promise<string> {
  if (explicit) {
    return explicit;
  }
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["config", "user.name"],
      { timeout: 5_000 },
    );
    const name = stdout.trim();
    if (name) {
      return name;
    }
  } catch {
    // ignore
  }
  return "operator";
}

export async function buildProvenance(
  input: ProvenanceInput = {},
): Promise<EnvironmentProvenance> {
  const actor = await resolveActor(input.actor);
  const provenance: EnvironmentProvenance = {
    actor,
    recordedAt: new Date().toISOString(),
  };
  if (input.harness) {
    provenance.harness = input.harness;
  }
  if (input.sessionId) {
    provenance.sessionId = input.sessionId;
  }
  if (input.goal) {
    provenance.goal = input.goal;
  }
  return provenance;
}
