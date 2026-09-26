import { promises as fs } from "fs";
import chalk from "chalk";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { StateStore } from "../../core/state-store.js";
import { configureAdapter, getAdapter } from "../../providers/index.js";
import { parseProvider } from "../../providers/catalog.js";
import { detectHarnesses, parseHarness } from "../../utils/harness.js";
import { emitOk, mapThrownError } from "../output.js";
import { reapExpiredEnvironments } from "../reap.js";
import { isExpired } from "../../utils/ttl.js";

interface DoctorOptions {
  json?: boolean;
  reap?: boolean;
  harness?: string;
}

function packageVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(
      readFileSync(join(here, "../../../package.json"), "utf-8"),
    ) as { version?: string };
    return pkg.version ?? "0.3.0";
  } catch {
    return "0.3.0";
  }
}

function presence(value: string | undefined): "set" | "missing" {
  return value ? "set" : "missing";
}

function readinessNextAction(report: {
  initialized: boolean;
  expiredCount: number;
  harness?: string;
}): string {
  if (!report.initialized) {
    return "sandman init aws --json";
  }
  if (report.expiredCount > 0) {
    return "sandman doctor --reap --json";
  }
  if (report.harness) {
    return `sandman connect-agent --harness ${report.harness}`;
  }
  return "sandman up --json";
}

export async function doctor(
  store: StateStore,
  options: DoctorOptions = {},
): Promise<void> {
  const providerConfig = await store.getProvider();
  const operator = await store.getOperator();
  const lockPath = store.getLockPath();
  let lockPresent = false;
  try {
    await fs.access(lockPath);
    lockPresent = true;
  } catch {
    lockPresent = false;
  }

  const environments = await store.listEnvironments();
  const expired = environments.filter((env) => isExpired(env)).map((env) => ({
    name: env.name,
    expiresAt: env.expiresAt,
  }));

  let reaped: { name: string; reaped: boolean; error?: string }[] = [];
  if (options.reap) {
    reaped = await reapExpiredEnvironments(store);
  }

  let identity: Record<string, string | null | undefined> | undefined;
  let identityError: { code: string; error: string } | undefined;
  const providerType = providerConfig.provider
    ? parseProvider(String(providerConfig.provider))
    : undefined;

  if (providerType) {
    try {
      const adapter = getAdapter(providerType);
      await adapter.init();
      configureAdapter(adapter, {
        region: providerConfig.region,
        billingAccount: providerConfig.billingAccount,
      });
      if (typeof adapter.discoverBillingAccount === "function") {
        const discovered = await adapter.discoverBillingAccount();
        if (discovered && !providerConfig.billingAccount) {
          providerConfig.billingAccount = discovered;
        }
      }
      if (typeof adapter.whoami === "function") {
        identity = await adapter.whoami();
      }
    } catch (error: unknown) {
      identityError = mapThrownError(error);
    }
  }

  const harnesses = detectHarnesses();
  const harnessName = options.harness
    ? parseHarness(options.harness)
    : undefined;
  const harnessReport = harnessName
    ? harnesses.find((item) => item.harness === harnessName)
    : undefined;

  const readiness =
    reportReadiness({
      initialized: Boolean(providerConfig.provider),
      identityError,
      expiredCount: expired.length,
      harnessInstalled: harnessReport?.installed ?? false,
    });

  const report = {
    version: packageVersion(),
    configPath: store.getConfigPath(),
    lockPath,
    lockPresent,
    initialized: Boolean(providerConfig.provider),
    provider: providerConfig.provider ?? null,
    region: providerConfig.region ?? null,
    billingAccount: providerConfig.billingAccount ?? null,
    operator: operator ?? null,
    identity: identity ?? null,
    identityError: identityError ?? null,
    harnesses,
    harness: harnessReport ?? null,
    readiness,
    nextAction: readinessNextAction({
      initialized: Boolean(providerConfig.provider),
      expiredCount: expired.length,
      harness: harnessName,
    }),
    environments: {
      total: environments.length,
      expired,
    },
    ...(options.reap ? { reaped } : {}),
    auth: {
      AWS_ACCESS_KEY_ID: presence(process.env.AWS_ACCESS_KEY_ID),
      AWS_SECRET_ACCESS_KEY: presence(process.env.AWS_SECRET_ACCESS_KEY),
      AWS_PROFILE: presence(process.env.AWS_PROFILE),
      GOOGLE_APPLICATION_CREDENTIALS: presence(
        process.env.GOOGLE_APPLICATION_CREDENTIALS,
      ),
      GCP_PROJECT: presence(process.env.GCP_PROJECT),
      GCP_BILLING_ACCOUNT: presence(process.env.GCP_BILLING_ACCOUNT),
      CLOUDFLARE_API_TOKEN: presence(process.env.CLOUDFLARE_API_TOKEN),
      VERCEL_TOKEN: presence(process.env.VERCEL_TOKEN),
    },
  };

  emitOk(options.json, report, () => {
    console.log(chalk.bold("\nSandman doctor\n"));
    console.log(`  ${chalk.gray("Version:")} ${report.version}`);
    console.log(`  ${chalk.gray("Config:")} ${report.configPath}`);
    console.log(
      `  ${chalk.gray("Lock:")} ${lockPresent ? chalk.yellow("held") : "clear"} (${lockPath})`,
    );
    console.log(
      `  ${chalk.gray("Init:")} ${report.initialized ? chalk.green(String(report.provider)) : chalk.red("not run")}`,
    );
    if (operator) {
      console.log(`  ${chalk.gray("Operator:")} ${operator.name}`);
    }
    if (report.region) {
      console.log(`  ${chalk.gray("Region:")} ${report.region}`);
    }
    if (report.billingAccount) {
      console.log(`  ${chalk.gray("Billing:")} ${report.billingAccount}`);
    }
    if (identity) {
      console.log(`  ${chalk.gray("Identity:")} ${JSON.stringify(identity)}`);
    }
    if (identityError) {
      console.log(
        `  ${chalk.red("Identity error:")} ${identityError.code}: ${identityError.error}`,
      );
    }
    console.log(`  ${chalk.gray("Readiness:")} ${readiness}`);
    console.log(`  ${chalk.gray("Next:")} ${report.nextAction}`);
    console.log(
      `  ${chalk.gray("Environments:")} ${report.environments.total} (${expired.length} expired)`,
    );
    for (const env of expired) {
      console.log(
        chalk.yellow(`    - ${env.name} expired ${env.expiresAt}`),
      );
    }
    if (options.reap) {
      for (const item of reaped) {
        if (item.reaped) {
          console.log(chalk.green(`    reaped ${item.name}`));
        } else if (item.error) {
          console.log(chalk.red(`    failed to reap ${item.name}: ${item.error}`));
        }
      }
    }
    console.log(`  ${chalk.gray("Auth presence:")}`);
    for (const [key, value] of Object.entries(report.auth)) {
      console.log(`    ${key}=${value}`);
    }
    if (!report.initialized) {
      console.log(chalk.cyan('\n→ Run "sandman init aws" or "sandman init gcp"'));
    }
  });
}

function reportReadiness(input: {
  initialized: boolean;
  identityError?: { code: string; error: string };
  expiredCount: number;
  harnessInstalled: boolean;
}): string {
  if (!input.initialized) {
    return "needs_init";
  }
  if (input.identityError?.code === "AUTH_REQUIRED") {
    return "auth_required";
  }
  if (input.expiredCount > 0) {
    return "expired_environments";
  }
  if (input.harnessInstalled) {
    return "ready";
  }
  return "ready_no_harness";
}
