import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { Command } from "commander";
import { StateStore } from "../core/state-store.js";
import { listEnvironments } from "./commands/list.js";
import { statusEnvironment } from "./commands/status.js";
import { initProvider } from "./commands/init.js";
import { createEnvironment } from "./commands/create.js";
import { enableServices } from "./commands/enable.js";
import { connectEnvironment } from "./commands/connect.js";
import { destroyEnvironment } from "./commands/destroy.js";
import { listProviders } from "./commands/providers.js";
import { doctor } from "./commands/doctor.js";
import { onboard } from "./commands/onboard.js";
import { up } from "./commands/up.js";
import { connectAgent } from "./commands/connect-agent.js";
import { handoffEnvironment } from "./commands/handoff.js";
import { listTemplates } from "./commands/templates.js";
import { checkpointEnvironment } from "./commands/checkpoint.js";
import { rollbackEnvironment } from "./commands/rollback.js";
import { mcpServe } from "./commands/mcp.js";
import { viewEnvironments } from "./commands/view.js";
import { linkEnvironment } from "./commands/link.js";
import { verifyEnvironment } from "./commands/verify.js";
import { seedState } from "./commands/seed.js";
import { runCommand } from "./output.js";

function packageVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(
      readFileSync(join(here, "../../package.json"), "utf-8"),
    ) as { version?: string };
    return pkg.version ?? "0.3.0";
  } catch {
    return "0.3.0";
  }
}

const program = new Command();
const store = new StateStore();

program
  .name("sandman")
  .description("Provision disposable cloud environments in seconds")
  .version(packageVersion());

program
  .command("onboard", { isDefault: true, hidden: true })
  .description("Record the operator and detect installed harnesses")
  .option("--name <name>", "Operator name")
  .option("--json", "Output as JSON")
  .action(async (options: { name?: string; json?: boolean }) => {
    await runCommand(options.json, "onboard", () =>
      onboard(store, options),
    );
  });

program
  .command("init")
  .description("Initialize a cloud provider")
  .argument("<provider>", "Provider to initialize: aws | gcp | cloudflare | vercel")
  .option("-r, --region <region>", "Default region")
  .option("--billing-account <id>", "GCP billing account ID")
  .option("--use-aws-profile <profile>", "Use an existing AWS CLI profile")
  .option("--use-gcloud", "Use active gcloud application-default credentials")
  .option("--use-env", "Use provider credentials from environment variables")
  .option("--json", "Output as JSON")
  .action(async (
    provider: string,
    options: {
      region?: string;
      billingAccount?: string;
      useAwsProfile?: string;
      useGcloud?: boolean;
      useEnv?: boolean;
      json?: boolean;
    },
  ) => {
    await runCommand(options.json, "init", () =>
      initProvider(provider, options.region, store, options),
    );
  });

program
  .command("create")
  .description("Create a sandbox environment")
  .argument("<name>", "Environment name (lowercase letters, digits, hyphens)")
  .option("-p, --provider <provider>", "Cloud provider: aws | gcp | cloudflare | vercel")
  .option("-r, --region <region>", "Region")
  .option("--billing-account <id>", "GCP billing account ID")
  .option("--ttl <duration>", "Auto-destroy after a duration such as 30m, 2h, or 1d")
  .option("--template <id>", "Built-in template: web-app | data-pipeline | ai-agent")
  .option("--goal <text>", "Record a goal in environment provenance")
  .option("--harness <name>", "Harness name for provenance")
  .option("--actor <name>", "Actor name for provenance")
  .option("--session-id <id>", "Session id for provenance")
  .option("--strict", "Exit non-zero when create finishes as failed/partial")
  .option("--dry-run", "Preview actions without executing")
  .option("--json", "Output as JSON")
  .action(async (name: string, options: {
    provider?: string;
    region?: string;
    billingAccount?: string;
    ttl?: string;
    template?: string;
    goal?: string;
    harness?: string;
    actor?: string;
    sessionId?: string;
    strict?: boolean;
    dryRun?: boolean;
    json?: boolean;
  }) => {
    await runCommand(options.json, "create", () =>
      createEnvironment(name, options, store, {
        dryRun: options.dryRun,
        json: options.json,
        strict: options.strict,
      }),
    );
  });

program
  .command("enable")
  .description("Enable services for an environment")
  .argument("<services...>", "Services to enable")
  .option("-e, --environment <name>", "Environment name")
  .option("--json", "Output as JSON")
  .action(async (services: string[], options: { environment?: string; json?: boolean }) => {
    await runCommand(options.json, "enable", () =>
      enableServices(services, options.environment, store, { json: options.json }),
    );
  });

program
  .command("list")
  .description("List all environments")
  .option("--json", "Output as JSON")
  .action(async (options: { json?: boolean }) => {
    await runCommand(options.json, "list", () => listEnvironments(store, options));
  });

program
  .command("status")
  .description("Show environment status")
  .argument("<name>", "Environment name")
  .option("--json", "Output as JSON")
  .action(async (name: string, options: { json?: boolean }) => {
    await runCommand(options.json, "status", () =>
      statusEnvironment(name, store, options),
    );
  });

program
  .command("connect")
  .description("Connect to an environment and output credentials")
  .argument("<name>", "Environment name")
  .option("--json", "Output as JSON")
  .option("--show-secrets", "Include secret values (tokens) in output")
  .action(async (name: string, options: { json?: boolean; showSecrets?: boolean }) => {
    await runCommand(options.json, "connect", () =>
      connectEnvironment(name, store, options),
    );
  });

program
  .command("destroy")
  .description("Destroy an environment")
  .argument("<name>", "Environment name")
  .option("-y, --yes", "Skip confirmation")
  .option("--json", "Output as JSON")
  .action(async (name: string, options: { yes?: boolean; json?: boolean }) => {
    await runCommand(options.json, "destroy", () =>
      destroyEnvironment(name, store, { confirmed: options.yes ?? false, json: options.json }),
    );
  });

program
  .command("providers")
  .description("List supported providers and their maturity")
  .option("--json", "Output as JSON")
  .action(async (options: { json?: boolean }) => {
    await runCommand(options.json, "providers", () => listProviders(options));
  });

program
  .command("doctor")
  .alias("whoami")
  .description("Show auth, init, identity, lock, and expired environments")
  .option("--reap", "Destroy environments whose TTL has expired")
  .option("--harness <name>", "Check readiness for a specific harness")
  .option("--json", "Output as JSON")
  .action(async (options: { json?: boolean; reap?: boolean; harness?: string }) => {
    await runCommand(options.json, "doctor", () => doctor(store, options));
  });

program
  .command("up")
  .description("Guided first environment: init, create, enable, connect")
  .option("-p, --provider <provider>", "Cloud provider")
  .option("-n, --name <name>", "Environment name", "sandbox")
  .option("--template <id>", "Template to apply", "web-app")
  .option("--json", "Output as JSON")
  .action(async (options: {
    provider?: string;
    name?: string;
    template?: string;
    json?: boolean;
  }) => {
    await runCommand(options.json, "up", () => up(store, options));
  });

program
  .command("connect-agent")
  .description("Write Sandman MCP config into a harness")
  .requiredOption("--harness <name>", "Harness: cursor | codex | opencode")
  .option("--config <path>", "Override harness config path")
  .option("--json", "Output as JSON")
  .action(async (options: { harness: string; config?: string; json?: boolean }) => {
    await runCommand(options.json, "connect-agent", () =>
      connectAgent(store, options),
    );
  });

program
  .command("handoff")
  .description("Write a continuation package for another harness")
  .argument("<name>", "Environment name")
  .requiredOption("--to <harness>", "Target harness: cursor | codex | opencode")
  .option("--json", "Output as JSON")
  .action(async (name: string, options: { to: string; json?: boolean }) => {
    await runCommand(options.json, "handoff", () =>
      handoffEnvironment(name, store, options),
    );
  });

program
  .command("templates")
  .description("List built-in environment templates")
  .option("--json", "Output as JSON")
  .action(async (options: { json?: boolean }) => {
    await runCommand(options.json, "templates", () => listTemplates(options));
  });

program
  .command("checkpoint")
  .description("Snapshot environment state locally")
  .argument("<name>", "Environment name")
  .argument("[message]", "Checkpoint message")
  .option("--json", "Output as JSON")
  .action(async (name: string, message: string | undefined, options: { json?: boolean }) => {
    await runCommand(options.json, "checkpoint", () =>
      checkpointEnvironment(name, store, { json: options.json, message }),
    );
  });

program
  .command("rollback")
  .description("Restore the latest local checkpoint")
  .argument("<name>", "Environment name")
  .option("--last", "Restore the most recent checkpoint")
  .option("--json", "Output as JSON")
  .action(async (name: string, options: { last?: boolean; json?: boolean }) => {
    await runCommand(options.json, "rollback", () =>
      rollbackEnvironment(name, store, options),
    );
  });

const mcp = program.command("mcp").description("Model Context Protocol interface");
mcp
  .command("serve")
  .description("Start the Sandman MCP server on stdio")
  .option("--json", "Emit a startup JSON line before serving")
  .action(async (options: { json?: boolean }) => {
    await runCommand(options.json, "mcp serve", () => mcpServe(store, options));
  });

program
  .command("view")
  .description("Start a read-only loopback environment viewer")
  .option("--host <host>", "Bind host", "127.0.0.1")
  .option("--port <port>", "Bind port", "9420")
  .option("--allow-remote", "Allow non-loopback binds")
  .option("--json", "Output as JSON")
  .action(async (options: {
    host?: string;
    port?: string;
    allowRemote?: boolean;
    json?: boolean;
  }) => {
    await runCommand(options.json, "view", () =>
      viewEnvironments(store, {
        host: options.host,
        port: options.port ? Number(options.port) : undefined,
        allowRemote: options.allowRemote,
        json: options.json,
      }),
    );
  });

program
  .command("link")
  .description("Register environment resources with another Boring Infra tool")
  .argument("<name>", "Environment name")
  .option("--combie", "Write a Combie link record")
  .option("--json", "Output as JSON")
  .action(async (name: string, options: { combie?: boolean; json?: boolean }) => {
    await runCommand(options.json, "link", () =>
      linkEnvironment(name, store, options),
    );
  });

program
  .command("verify")
  .description("Evaluate basic environment health claims")
  .argument("<name>", "Environment name")
  .option("--json", "Output as JSON")
  .action(async (name: string, options: { json?: boolean }) => {
    await runCommand(options.json, "verify", () =>
      verifyEnvironment(name, store, options),
    );
  });

program
  .command("seed")
  .description("Load deterministic local state for evals and tests")
  .option("--reset", "Replace local state with the seed fixture")
  .option("--json", "Output as JSON")
  .action(async (options: { reset?: boolean; json?: boolean }) => {
    await runCommand(options.json, "seed", () => seedState(store, options));
  });

export { program, store };
