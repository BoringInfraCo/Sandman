import chalk from "chalk";
import { BUILTIN_TEMPLATES } from "../../templates/index.js";
import { emitOk } from "../output.js";

interface TemplatesOptions {
  json?: boolean;
}

export async function listTemplates(
  options: TemplatesOptions = {},
): Promise<void> {
  emitOk(
    options.json,
    { templates: BUILTIN_TEMPLATES },
    () => {
      console.log(chalk.bold("\nSandman templates\n"));
      for (const template of BUILTIN_TEMPLATES) {
        console.log(`  ${chalk.cyan(template.id)}`);
        console.log(chalk.gray(`    ${template.description}`));
        for (const [provider, services] of Object.entries(template.services)) {
          console.log(chalk.gray(`    ${provider}: ${services.join(", ")}`));
        }
      }
    },
  );
}
