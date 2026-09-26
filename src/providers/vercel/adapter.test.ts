import { describe, it, expect, vi, beforeEach } from "vitest";
import { VercelAdapter } from "./adapter.js";
import { ServiceName } from "../../types/index.js";

global.fetch = vi.fn();

describe("VercelAdapter", () => {
  let adapter: VercelAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    adapter = new VercelAdapter();
    delete process.env.VERCEL_TEAM_ID;
  });

  describe("init", () => {
    it("should throw if VERCEL_TOKEN is missing", async () => {
      delete process.env.VERCEL_TOKEN;
      await expect(adapter.init()).rejects.toThrow(
        "VERCEL_TOKEN environment variable is required",
      );
    });

    it("should authenticate successfully", async () => {
      process.env.VERCEL_TOKEN = "test-token";

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: { id: "user123" } }),
      });

      await expect(adapter.init()).resolves.not.toThrow();
    });
  });

  describe("createEnvironment", () => {
    it("should create an environment record with project id", async () => {
      process.env.VERCEL_TOKEN = "test-token";
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "prj_123", name: "sandman-test-env" }),
      });

      const env = await adapter.createEnvironment("test-env");

      expect(env.name).toBe("test-env");
      expect(env.provider).toBe("vercel");
      expect(env.status).toBe("active");
      expect(env.projectId).toBe("prj_123");
      expect(env.resources.projectName).toBe("sandman-test-env");
    });
  });

  describe("enableServices", () => {
    it("should record services locally", async () => {
      const env = {
        name: "test",
        provider: "vercel" as const,
        status: "active" as const,
        services: [] as ServiceName[],
        resources: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await adapter.enableServices(env, ["functions", "edge", "blob"]);
      expect(result.mode).toBe("local-only");
      expect(result.recorded).toEqual(["functions", "edge", "blob"]);
    });
  });

  describe("connect", () => {
    it("should return environment variables", async () => {
      process.env.VERCEL_TEAM_ID = "team_abc";

      const env = {
        name: "test",
        provider: "vercel" as const,
        status: "active" as const,
        services: [] as ServiceName[],
        resources: { projectName: "my-project" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        projectId: "prj_123",
      };

      const creds = await adapter.connect(env);

      expect(creds.provider).toBe("vercel");
      expect(creds.VERCEL_PROJECT_ID).toBe("prj_123");
      expect(creds.VERCEL_PROJECT_NAME).toBe("my-project");
      expect(creds.VERCEL_TEAM_ID).toBe("team_abc");
    });
  });

  describe("destroyEnvironment", () => {
    it("should call the Vercel delete API", async () => {
      process.env.VERCEL_TOKEN = "test-token";
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const env = {
        name: "test",
        provider: "vercel" as const,
        status: "active" as const,
        services: [] as ServiceName[],
        resources: { projectId: "prj_123" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        projectId: "prj_123",
      };

      await adapter.destroyEnvironment(env);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.vercel.com/v9/projects/prj_123",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });
});
