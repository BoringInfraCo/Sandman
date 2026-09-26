import { promises as fs } from "fs";
import { join } from "path";
import { homedir } from "os";
import chalk from "chalk";
import { StateStore } from "../../core/state-store.js";
import { emitErr, emitOk } from "../output.js";

interface LinkOptions {
  json?: boolean;
  combie?: boolean;
}

function combieLinksDir(): string {
  return join(homedir(), ".combie", "sandman-links");
}

export async function linkEnvironment(
  name: string,
  store: StateStore,
  options: LinkOptions,
): Promise<void> {
  if (!options.combie) {
    emitErr(options.json, {
      code: "INVALID_INPUT",
      error: "Specify --combie to register resources with Combie.",
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

  const linkRecord = {
    source: "sandman",
    environment: env.name,
    provider: env.provider,
    region: env.region ?? null,
    projectId: env.projectId ?? null,
    accountId: env.accountId ?? null,
    resources: env.resources,
    services: env.services,
    linkedAt: new Date().toISOString(),
  };

  const dir = combieLinksDir();
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const path = join(dir, `${env.name}.json`);
  await fs.writeFile(path, JSON.stringify(linkRecord, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });

  env.combieLinked = true;
  await store.saveEnvironment(env);

  emitOk(
    options.json,
    {
      environment: name,
      combieLink: path,
      next: ["combie sync", `combie investigate sandman:${name}`],
    },
    () => {
      console.log(chalk.green(`Linked ${name} for Combie at ${path}`));
      console.log(chalk.cyan("→ Run combie sync to ingest the relationship"));
    },
  );
}
