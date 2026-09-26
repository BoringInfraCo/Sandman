import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type AuthShortcut =
  | "use-aws-profile"
  | "use-gcloud"
  | "use-env"
  | "use-gh";

export async function detectAwsProfile(
  profile = "default",
): Promise<{ ok: boolean; accountId?: string; error?: string }> {
  try {
    const { stdout } = await execFileAsync(
      "aws",
      ["sts", "get-caller-identity", "--profile", profile, "--output", "json"],
      { timeout: 15_000 },
    );
    const parsed = JSON.parse(stdout) as { Account?: string };
    return { ok: true, accountId: parsed.Account };
  } catch (error: unknown) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function detectGcloud(): Promise<{
  ok: boolean;
  account?: string;
  project?: string;
  error?: string;
}> {
  try {
    const { stdout } = await execFileAsync(
      "gcloud",
      ["auth", "list", "--filter=status:ACTIVE", "--format=json"],
      { timeout: 15_000 },
    );
    const accounts = JSON.parse(stdout) as { account?: string }[];
    const active = accounts[0]?.account;
    if (!active) {
      return { ok: false, error: "No active gcloud account found." };
    }
    let project: string | undefined;
    try {
      const { stdout: projectStdout } = await execFileAsync(
        "gcloud",
        ["config", "get-value", "project"],
        { timeout: 10_000 },
      );
      project = projectStdout.trim() || undefined;
    } catch {
      // optional
    }
    return { ok: true, account: active, project };
  } catch (error: unknown) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function detectEnvAuth(
  keys: string[],
): { ok: boolean; present: string[]; missing: string[] } {
  const present: string[] = [];
  const missing: string[] = [];
  for (const key of keys) {
    if (process.env[key]) {
      present.push(key);
    } else {
      missing.push(key);
    }
  }
  return { ok: missing.length === 0, present, missing };
}
