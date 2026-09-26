import { describe, expect, it } from "vitest";
import {
  CLI_JSON_SCHEMA,
  setJsonCommand,
  clearJsonCommand,
  wrapOk,
  wrapErr,
} from "./envelope.js";

describe("sandman.cli.v1 envelope", () => {
  it("wraps success payloads with schema", () => {
    expect(wrapOk({ name: "demo" })).toEqual({
      schema: CLI_JSON_SCHEMA,
      success: true,
      code: "OK",
      name: "demo",
    });
  });

  it("includes command when set", () => {
    setJsonCommand("list");
    expect(wrapOk({ environments: [] }).command).toBe("list");
    clearJsonCommand();
  });

  it("wraps error payloads with schema", () => {
    expect(wrapErr("NOT_FOUND", "missing")).toEqual({
      schema: CLI_JSON_SCHEMA,
      success: false,
      code: "NOT_FOUND",
      error: "missing",
    });
  });
});
