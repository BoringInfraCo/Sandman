import chalk from "chalk";
import { StateStore } from "../../core/state-store.js";
import { SEED_CONFIG } from "../../core/seed-data.js";
import { emitErr, emitOk } from "../output.js";

interface SeedOptions {
  json?: boolean;
  reset?: boolean;
}

export async function seedState(
  store: StateStore,
  options: SeedOptions = {},
): Promise<void> {
  if (!options.reset) {
    emitErr(options.json, {
      code: "CONFIRMATION_REQUIRED",
      error: "Pass --reset to load the deterministic seed fixture.",
      next: ["sandman seed --reset --json"],
    });
  }

  await store.replaceConfig(SEED_CONFIG);

  emitOk(
    options.json,
    {
      seeded: true,
      environments: Object.keys(SEED_CONFIG.environments),
      operator: SEED_CONFIG.operator,
    },
    () => {
      console.log(chalk.green("Loaded deterministic Sandman seed fixture."));
      console.log(
        chalk.gray(
          `Environments: ${Object.keys(SEED_CONFIG.environments).join(", ")}`,
        ),
      );
    },
  );
}
