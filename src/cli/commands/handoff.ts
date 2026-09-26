import { promises as fs } from "fs";
import { join } from "path";
import { homedir } from "os";
import chalk from "chalk";
import { StateStore } from "../../core/state-store.js";
import { getAdapter } from "../../providers/index.js";
import {
  calculateRunningCost,
  formatCost,
  formatHourlyRate,
} from "../../utils/cost-estimator.js";
import { budgetRecord } from "../../contract/budget.js";
import { parseHarness, type HarnessName } from "../../utils/harness.js";
import { emitErr, emitOk } from "../output.js";
import { isExpired } from "../../utils/ttl.js";

interface HandoffOptions {
  json?: boolean;
  to: string;
}

function handoffDir(): string {
  return join(homedir(), ".sandman", "handoffs");
}

function handoffFile(name: string, target: HarnessName): string {
  const safe = name.replace(/[^a-z0-9-]/gi, "_");
  return join(handoffDir(), `${safe}.${target}.md`);
}

export async function handoffEnvironment(
  name: string,
  store: StateStore,
  options: HandoffOptions,
): Promise<void> {
  const target = parseHarness(options.to);
  if (!target) {
    emitErr(options.json, {
      code: "INVALID_INPUT",
      error: `Unknown harness "${options.to}".`,
      hint: "Supported targets: cursor, codex, opencode",
    });
  }

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
  const runningCost = calculateRunningCost(
    status.provider,
    status.services,
    status.createdAt,
  );
  const { record: resources, budget } = budgetRecord(status.resources);

  const sections = {
    goal: status.provenance?.goal,
    environment: {
      name: status.name,
      provider: status.provider,
      region: status.region ?? null,
      status: status.status,
      services: status.services,
      template: status.template ?? null,
      ttl: status.ttl ?? null,
      expiresAt: status.expiresAt ?? null,
      expired: status.expiresAt ? isExpired(status) : false,
    },
    resources,
    provenance: status.provenance ?? null,
    costEstimate: {
      hourlyRate: runningCost.hourlyRate,
      totalCost: runningCost.totalCost,
      estimatedDaily: runningCost.estimatedDaily,
    },
    commands: {
      connect: `sandman connect ${name} --json`,
      destroy: `sandman destroy ${name} -y --json`,
      status: `sandman status ${name} --json`,
    },
    receiverInstructions: [
      "Credentials are not authorization. Do not replay provisioning commands without explicit user approval.",
      "Run sandman connect to fetch credentials when needed.",
      "Destroy the environment when work is complete to avoid cloud charges.",
    ],
  };

  const markdown = [
    "# Sandman handoff",
    "",
    "Continue this environment work. Do not reprovision from scratch.",
    "",
    "## Environment",
    `- Name: ${status.name}`,
    `- Provider: ${status.provider}`,
    `- Status: ${status.status}`,
    status.region ? `- Region: ${status.region}` : "",
    status.template ? `- Template: ${status.template}` : "",
    status.expiresAt ? `- Expires: ${status.expiresAt}` : "",
    "",
    "## Services",
    status.services.length ? status.services.join(", ") : "none enabled",
    "",
    "## Resources",
    ...Object.entries(resources).map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`),
    "",
    "## Cost",
    `- Hourly: ${formatHourlyRate(runningCost.hourlyRate)}`,
    `- Current estimate: ${formatCost(runningCost.totalCost)}`,
    "",
    "## Commands",
    `- Connect: \`sandman connect ${name} --json\``,
    `- Destroy: \`sandman destroy ${name} -y --json\``,
    "",
    "## Receiver instructions",
    ...sections.receiverInstructions.map((line) => `- ${line}`),
    "",
  ]
    .filter(Boolean)
    .join("\n");

  const dir = handoffDir();
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const file = handoffFile(name, target);
  await fs.writeFile(file, markdown, { encoding: "utf-8", mode: 0o600 });

  emitOk(
    options.json,
    {
      environment: name,
      target,
      file,
      sections,
      budget,
    },
    () => {
      console.log(chalk.green(`Handoff written to ${file}`));
      console.log(chalk.gray(`Target harness: ${target}`));
    },
  );
}
