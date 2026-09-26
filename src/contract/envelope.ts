export const CLI_JSON_SCHEMA = "sandman.cli.v1";

let activeCommand: string | undefined;

export function setJsonCommand(command: string): void {
  activeCommand = command;
}

export function getJsonCommand(): string | undefined {
  return activeCommand;
}

export function clearJsonCommand(): void {
  activeCommand = undefined;
}

export interface JsonEnvelope extends Record<string, unknown> {
  schema: typeof CLI_JSON_SCHEMA;
  command?: string;
  success: boolean;
  code: string;
}

export function wrapOk(
  data: Record<string, unknown> = {},
): JsonEnvelope {
  const envelope: JsonEnvelope = {
    schema: CLI_JSON_SCHEMA,
    success: true,
    code: "OK",
    ...data,
  };
  if (activeCommand) {
    envelope.command = activeCommand;
  }
  return envelope;
}

export function wrapErr(
  code: string,
  error: string,
  extra: Record<string, unknown> = {},
): JsonEnvelope {
  const envelope: JsonEnvelope = {
    schema: CLI_JSON_SCHEMA,
    success: false,
    code,
    error,
    ...extra,
  };
  if (activeCommand) {
    envelope.command = activeCommand;
  }
  return envelope;
}

export function stringifyEnvelope(envelope: JsonEnvelope): string {
  return `${JSON.stringify(envelope)}\n`;
}
