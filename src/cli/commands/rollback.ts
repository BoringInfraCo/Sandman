import chalk from "chalk";
import { StateStore } from "../../core/state-store.js";
import { latestCheckpoint } from "../../core/checkpoints.js";
import { emitErr, emitOk } from "../output.js";

interface RollbackOptions {
  json?: boolean;
  last?: boolean;
}

export async function rollbackEnvironment(
  name: string,
  store: StateStore,
  options: RollbackOptions = {},
): Promise<void> {
  if (!options.last) {
    emitErr(options.json, {
      code: "INVALID_INPUT",
      error: "Specify --last to restore the most recent checkpoint.",
    });
  }

  const checkpoint = await latestCheckpoint(store.getConfigPath(), name);
  if (!checkpoint) {
    emitErr(options.json, {
      code: "NOT_FOUND",
      error: `No checkpoint found for "${name}".`,
      next: [`sandman checkpoint ${name} --json`],
    });
  }

  await store.saveEnvironment(checkpoint.environment);

  emitOk(
    options.json,
    {
      checkpoint,
      restored: checkpoint.environment,
      next: [
        `sandman status ${name} --json`,
        `sandman destroy ${name} -y --json`,
      ],
      hint:
        "State was restored locally. Cloud resources are not automatically rolled back.",
    },
    () => {
      console.log(chalk.green(`Restored ${name} from ${checkpoint.id}.`));
      console.log(
        chalk.yellow(
          "Cloud resources were not changed. Run destroy manually if drift exists.",
        ),
      );
    },
  );
}
