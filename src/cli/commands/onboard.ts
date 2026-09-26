import chalk from "chalk";
import { StateStore } from "../../core/state-store.js";
import { detectHarnesses } from "../../utils/harness.js";
import { resolveActor } from "../../utils/provenance.js";
import { emitOk } from "../output.js";

interface OnboardOptions {
  json?: boolean;
  name?: string;
}

export async function onboard(
  store: StateStore,
  options: OnboardOptions = {},
): Promise<void> {
  const name = options.name || (await resolveActor());
  const existing = await store.getOperator();
  if (existing && !options.json) {
    console.log(chalk.gray(`Operator already recorded as ${existing.name}.`));
    console.log(chalk.cyan('→ Run "sandman up" to start or "sandman doctor" to inspect.'));
    return;
  }

  if (!existing) {
    await store.setOperator(name);
  }

  const harnesses = detectHarnesses();
  const installed = harnesses.filter((h) => h.installed);

  emitOk(
    options.json,
    {
      operator: existing ?? { name, recordedAt: new Date().toISOString() },
      harnesses,
      installedHarnesses: installed.map((h) => h.harness),
      nextAction: installed.length
        ? "sandman connect-agent --harness <name>"
        : "sandman init <provider>",
    },
    () => {
      console.log(chalk.green(`Recorded operator ${name}.`));
      if (installed.length) {
        console.log(
          chalk.gray(
            `Detected harnesses: ${installed.map((h) => h.harness).join(", ")}`,
          ),
        );
        console.log(
          chalk.cyan(
            '→ Run "sandman connect-agent --harness cursor" to wire Sandman MCP',
          ),
        );
      } else {
        console.log(chalk.gray("No known harness config files found."));
      }
      console.log(chalk.cyan('→ Run "sandman up" for a guided first environment'));
    },
  );
}
