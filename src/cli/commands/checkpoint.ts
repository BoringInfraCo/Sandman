import chalk from "chalk";
import { StateStore } from "../../core/state-store.js";
import { saveCheckpoint } from "../../core/checkpoints.js";
import { emitErr, emitOk } from "../output.js";

interface CheckpointOptions {
  json?: boolean;
  message?: string;
}

export async function checkpointEnvironment(
  name: string,
  store: StateStore,
  options: CheckpointOptions = {},
): Promise<void> {
  const env = await store.getEnvironment(name);
  if (!env || env.status === "destroyed") {
    emitErr(options.json, {
      code: "NOT_FOUND",
      error: `Environment "${name}" not found.`,
      next: ["sandman list --json"],
    });
  }

  const record = await saveCheckpoint(
    store.getConfigPath(),
    env,
    options.message,
  );

  emitOk(
    options.json,
    { checkpoint: record },
    () => {
      console.log(chalk.green(`Checkpoint ${record.id} saved.`));
      if (record.message) {
        console.log(chalk.gray(record.message));
      }
    },
  );
}
