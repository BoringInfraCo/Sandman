import { describe, it, expect, vi, beforeEach } from "vitest";
import { CloudflareAdapter } from "./adapter.js";
import { ServiceName } from "../../types/index.js";

global.fetch = vi.fn();

describe("CloudflareAdapter", () => {
  let adapter: CloudflareAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    adapter = new CloudflareAdapter();
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
  });

  describe("init", () => {
    it("should throw if CLOUDFLARE_API_TOKEN is missing", async () => {
      delete process.env.CLOUDFLARE_API_TOKEN;
      await expect(adapter.init()).rejects.toThrow(
        "CLOUDFLARE_API_TOKEN environment variable is required",
      );
    });

    it("should authenticate and fetch account ID", async () => {
      process.env.CLOUDFLARE_API_TOKEN = "test-token";
      process.env.CLOUDFLARE_ACCOUNT_ID = "abc123";

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, result: { id: "user123" } }),
      });

      await adapter.init();
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/user",
        expect.any(Object),
      );
    });

    it("should throw on authentication failure", async () => {
      process.env.CLOUDFLARE_API_TOKEN = "bad-token";

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ errors: [{ message: "Invalid token" }] }),
      });

      await expect(adapter.init()).rejects.toThrow(
        "Cloudflare API error: Invalid token",
      );
    });
  });

  describe("createEnvironment", () => {
    it("should create an environment record with kv namespace", async () => {
      process.env.CLOUDFLARE_API_TOKEN = "test-token";
      process.env.CLOUDFLARE_ACCOUNT_ID = "account123";
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, result: { id: "user123" } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            result: { id: "kv-123", title: "sandman-test-env" },
          }),
        });

      await adapter.init();
      const env = await adapter.createEnvironment("test-env");

      expect(env.name).toBe("test-env");
      expect(env.provider).toBe("cloudflare");
      expect(env.status).toBe("active");
      expect(env.resources.kvNamespaceId).toBe("kv-123");
      expect(env.accountId).toBe("account123");
    });
  });

  describe("enableServices", () => {
    it("should mark kv as provisioned when namespace exists", async () => {
      const env = {
        name: "test",
        provider: "cloudflare" as const,
        status: "active" as const,
        services: [] as ServiceName[],
        resources: { kvNamespaceId: "kv-123" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        accountId: "account123",
      };

      const result = await adapter.enableServices(env, ["workers", "kv", "d1"]);
      expect(result.provisioned).toContain("kv");
      expect(result.localOnly.length).toBeGreaterThan(0);
    });
  });

  describe("connect", () => {
    it("should return environment variables", async () => {
      const env = {
        name: "test",
        provider: "cloudflare" as const,
        status: "active" as const,
        services: [] as ServiceName[],
        resources: { kvNamespaceId: "ns-123" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        accountId: "my-account",
      };

      const creds = await adapter.connect(env);

      expect(creds.provider).toBe("cloudflare");
      expect(creds.CLOUDFLARE_ACCOUNT_ID).toBe("my-account");
      expect(creds.CLOUDFLARE_KV_NAMESPACE_ID).toBe("ns-123");
    });
  });

  describe("destroyEnvironment", () => {
    it("should attempt kv cleanup", async () => {
      process.env.CLOUDFLARE_API_TOKEN = "test-token";
      process.env.CLOUDFLARE_ACCOUNT_ID = "account123";
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, result: { id: "user123" } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        });

      await adapter.init();
      const env = {
        name: "test",
        provider: "cloudflare" as const,
        status: "active" as const,
        services: [] as ServiceName[],
        resources: { kvNamespaceId: "ns-123" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await adapter.destroyEnvironment(env);
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
