import { afterEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { StateStore } from "../../core/state-store.js";
import { listTemplates } from "./templates.js";
import { handoffEnvironment } from "./handoff.js";
import { seedState } from "./seed.js";
import { checkpointEnvironment } from "./checkpoint.js";
import { rollbackEnvironment } from "./rollback.js";
import { verifyEnvironment } from "./verify.js";
import { linkEnvironment } from "./link.js";

const testConfigPath = join(tmpdir(), `sandman-portfolio-${process.pid}.json`);

function mockExit() {
  return vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new Error(`EXIT:${code}`);
  }) as typeof process.exit);
}

describe("portfolio commands", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.unlink(testConfigPath).catch(() => undefined);
    await fs.unlink(`${testConfigPath}.lock`).catch(() => undefined);
  });

  it("lists templates in JSON mode", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await listTemplates({ json: true });
    const parsed = JSON.parse(String(log.mock.calls[0][0]));
    expect(parsed.schema).toBe("sandman.cli.v1");
    expect(parsed.templates.length).toBeGreaterThan(0);
  });

  it("writes a handoff package", async () => {
    const store = new StateStore(testConfigPath);
    await store.saveEnvironment({
      name: "demo",
      provider: "aws",
      status: "active",
      services: ["s3"],
      resources: { bucketName: "sandman-demo" },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      provenance: { actor: "tester", goal: "demo" },
    });

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await handoffEnvironment("demo", store, { json: true, to: "cursor" });
    const parsed = JSON.parse(String(log.mock.calls[0][0]));
    expect(parsed.target).toBe("cursor");
    expect(parsed.sections.environment.name).toBe("demo");
    expect(parsed.file).toContain("handoffs");
  });

  it("loads seed fixture with reset", async () => {
    const store = new StateStore(testConfigPath);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await seedState(store, { json: true, reset: true });
    const parsed = JSON.parse(String(log.mock.calls[0][0]));
    expect(parsed.seeded).toBe(true);
    const env = await store.getEnvironment("demo-seed");
    expect(env?.name).toBe("demo-seed");
  });

  it("checkpoint and rollback restore local state", async () => {
    const store = new StateStore(testConfigPath);
    await store.saveEnvironment({
      name: "demo",
      provider: "aws",
      status: "active",
      services: ["s3"],
      resources: { bucketName: "v1" },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await checkpointEnvironment("demo", store, { json: true, message: "snap" });

    const current = await store.getEnvironment("demo");
    current!.resources.bucketName = "v2";
    await store.saveEnvironment(current!);

    await rollbackEnvironment("demo", store, { json: true, last: true });
    const restored = await store.getEnvironment("demo");
    expect(restored?.resources.bucketName).toBe("v1");
  });

  it("verifies environment claims", async () => {
    const store = new StateStore(testConfigPath);
    await store.saveEnvironment({
      name: "demo",
      provider: "aws",
      status: "active",
      services: ["s3"],
      resources: { bucketName: "sandman-demo" },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await verifyEnvironment("demo", store, { json: true });
    const parsed = JSON.parse(String(log.mock.calls[0][0]));
    expect(parsed.menoCompatible).toBe(true);
    expect(parsed.claims.some((c: { claim: string }) => c.claim === "environment_exists")).toBe(true);
  });

  it("writes combie link records", async () => {
    const store = new StateStore(testConfigPath);
    const combieDir = join(tmpdir(), `combie-links-${process.pid}`);
    process.env.HOME = tmpdir();
    await store.saveEnvironment({
      name: "demo",
      provider: "vercel",
      status: "active",
      services: ["functions"],
      resources: { projectId: "prj_1" },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      projectId: "prj_1",
    });

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await linkEnvironment("demo", store, { json: true, combie: true });
    const parsed = JSON.parse(String(log.mock.calls[0][0]));
    expect(parsed.combieLink).toContain("sandman-links");
    await fs.rm(combieDir, { recursive: true, force: true }).catch(() => undefined);
  });

  it("seed requires reset confirmation", async () => {
    const store = new StateStore(testConfigPath);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    mockExit();
    await expect(seedState(store, { json: true })).rejects.toThrow(/EXIT:1/);
    const parsed = JSON.parse(String(log.mock.calls[0][0]));
    expect(parsed.code).toBe("CONFIRMATION_REQUIRED");
  });
});
