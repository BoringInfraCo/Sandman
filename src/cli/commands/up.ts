import chalk from "chalk";
import { StateStore } from "../../core/state-store.js";
import { initProvider } from "./init.js";
import { createEnvironment } from "./create.js";
import { enableServices } from "./enable.js";
import { connectEnvironment } from "./connect.js";
import { onboard } from "./onboard.js";
import { templateServices } from "../../templates/index.js";
import { parseProvider } from "../../providers/catalog.js";
import { emitErr } from "../output.js";

interface UpOptions {
  json?: boolean;
  provider?: string;
  name?: string;
  template?: string;
}

export async function up(
  store: StateStore,
  options: UpOptions = {},
): Promise<void> {
  await onboard(store, { json: options.json });

  const providerConfig = await store.getProvider();
  const provider =
    (options.provider && parseProvider(options.provider)) ||
    providerConfig.provider;

  if (!provider) {
    emitErr(options.json, {
      code: "NO_PROVIDER",
      error: "No provider configured.",
      next: ["sandman init aws --json", "sandman init gcp --json"],
    });
  }

  if (!providerConfig.provider) {
    await initProvider(provider, providerConfig.region, store, {
      json: options.json,
      billingAccount: providerConfig.billingAccount,
    });
  }

  const envName = options.name || "sandbox";
  const existing = await store.getEnvironment(envName);
  const template = options.template || "web-app";

  if (!existing || existing.status === "destroyed") {
    await createEnvironment(
      envName,
      {
        provider,
        region: providerConfig.region,
        billingAccount: providerConfig.billingAccount,
        ttl: "2h",
        template,
        goal: "Sandman up default environment",
      },
      store,
      { json: options.json, strict: false },
    );
  } else {
    const services = templateServices(template, provider);
    if (services.length) {
      await enableServices(services, envName, store, { json: options.json });
    }
  }

  if (!options.json) {
    console.log(
      chalk.yellow(
        `Remember to run "sandman destroy ${envName}" when finished to avoid charges.`,
      ),
    );
  }

  await connectEnvironment(envName, store, {
    json: options.json,
    showSecrets: false,
  });
}
