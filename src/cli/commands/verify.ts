import chalk from "chalk";
import { StateStore } from "../../core/state-store.js";
import { getAdapter } from "../../providers/index.js";
import { emitErr, emitOk } from "../output.js";
import { isExpired } from "../../utils/ttl.js";

interface VerifyOptions {
  json?: boolean;
}

interface ClaimResult {
  claim: string;
  verdict: "proven" | "disproven" | "unknown";
  evidence?: string;
}

export async function verifyEnvironment(
  name: string,
  store: StateStore,
  options: VerifyOptions = {},
): Promise<void> {
  const env = await store.getEnvironment(name);
  if (!env || env.status === "destroyed") {
    emitErr(options.json, {
      code: "NOT_FOUND",
      error: `Environment "${name}" not found.`,
      next: ["sandman list --json"],
    });
  }

  const adapter = getAdapter(env.provider);
  const status = await adapter.getStatus(env);
  const claims: ClaimResult[] = [
    {
      claim: "environment_exists",
      verdict: status.status !== "destroyed" ? "proven" : "disproven",
      evidence: `status=${status.status}`,
    },
    {
      claim: "ttl_not_expired",
      verdict:
        !status.expiresAt || !isExpired(status)
          ? "proven"
          : "disproven",
      evidence: status.expiresAt ?? "no ttl",
    },
    {
      claim: "services_enabled",
      verdict: status.services.length > 0 ? "proven" : "unknown",
      evidence: status.services.join(", ") || "none",
    },
    {
      claim: "resources_recorded",
      verdict:
        Object.keys(status.resources).length > 0 ? "proven" : "unknown",
      evidence: `${Object.keys(status.resources).length} resources`,
    },
  ];

  const summary = {
    subject: `sandman:${name}`,
    adapter: "sandman",
    claims,
    menoCompatible: true,
    next: ["meno verify", `meno inspect sandman:${name}`],
  };

  emitOk(options.json, summary, () => {
    console.log(chalk.bold(`\nVerification for ${name}\n`));
    for (const item of claims) {
      const color =
        item.verdict === "proven"
          ? chalk.green
          : item.verdict === "disproven"
            ? chalk.red
            : chalk.yellow;
      console.log(`  ${color(item.verdict)} ${item.claim}`);
      if (item.evidence) {
        console.log(chalk.gray(`    ${item.evidence}`));
      }
    }
    console.log(chalk.cyan("\n→ Export to Meno with meno verify when configured"));
  });
}
