import chalk from "chalk";
import { stringifyEnvelope, wrapErr, wrapOk } from "../contract/envelope.js";

export type ResultCode =
  | "OK"
  | "NOT_FOUND"
  | "ALREADY_EXISTS"
  | "NO_PROVIDER"
  | "INVALID_PROVIDER"
  | "INVALID_NAME"
  | "INVALID_SERVICE"
  | "AMBIGUOUS"
  | "AUTH_REQUIRED"
  | "CONFIRMATION_REQUIRED"
  | "PROVIDER_ERROR"
  | "STATE_CORRUPT"
  | "STATE_LOCKED"
  | "PARTIAL"
  | "EXPIRED"
  | "INVALID_TTL"
  | "INVALID_INPUT"
  | "UNSUPPORTED"
  | "INTERNAL";

export interface OkPayload extends Record<string, unknown> {
  success: true;
  code: "OK";
  schema: string;
  command?: string;
}

export interface ErrPayload extends Record<string, unknown> {
  success: false;
  code: ResultCode;
  error: string;
  schema: string;
  command?: string;
  hint?: string;
  next?: string[];
}

export function okPayload(data: Record<string, unknown> = {}): OkPayload {
  return wrapOk(data) as OkPayload;
}

export function errPayload(
  code: ResultCode,
  error: string,
  extra: Record<string, unknown> = {},
): ErrPayload {
  return wrapErr(code, error, extra) as ErrPayload;
}

export function emitOk(
  json: boolean | undefined,
  data: Record<string, unknown>,
  human: () => void,
): void {
  if (json) {
    console.log(stringifyEnvelope(wrapOk(data)).trimEnd());
    return;
  }
  human();
}

export function emitErr(
  json: boolean | undefined,
  payload: {
    code: ResultCode;
    error: string;
    hint?: string;
    next?: string[];
    [key: string]: unknown;
  },
  human?: () => void,
): never {
  const { code, error, hint, next, ...rest } = payload;
  if (json) {
    const extra: Record<string, unknown> = { ...rest };
    if (hint) extra.hint = hint;
    if (next) extra.next = next;
    console.log(stringifyEnvelope(wrapErr(code, error, extra)).trimEnd());
  } else if (human) {
    human();
  } else {
    console.error(chalk.red(`Error: ${error}`));
    if (hint) {
      console.error(chalk.gray(hint));
    }
    if (next) {
      for (const step of next) {
        console.error(chalk.cyan(`→ ${step}`));
      }
    }
  }
  process.exit(1);
}

export function mapThrownError(error: unknown): {
  code: ResultCode;
  error: string;
} {
  const message = error instanceof Error ? error.message : String(error);
  const maybeCode = (error as { code?: string } | undefined)?.code;

  if (maybeCode === "STATE_CORRUPT" || maybeCode === "STATE_LOCKED") {
    return { code: maybeCode, error: message };
  }
  if (
    /credentials required|authentication required|unauthenticated|authentication failed|api[_-]?token|VERCEL_TOKEN|environment variable is required/i.test(
      message,
    )
  ) {
    return { code: "AUTH_REQUIRED", error: message };
  }
  return { code: "PROVIDER_ERROR", error: message };
}

export async function runCommand(
  json: boolean | undefined,
  command: string,
  fn: () => Promise<void>,
): Promise<void> {
  const { setJsonCommand, clearJsonCommand } = await import(
    "../contract/envelope.js"
  );
  if (json) {
    setJsonCommand(command);
  }
  try {
    await fn();
  } catch (error) {
    emitErr(json, mapThrownError(error));
  } finally {
    if (json) {
      clearJsonCommand();
    }
  }
}
