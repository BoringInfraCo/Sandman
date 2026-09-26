import { ProviderAdapter, CLOUDFLARE_SERVICES } from "../base.js";
import {
  EnableResult,
  EnvironmentRecord,
  ServiceName,
} from "../../types/index.js";
import { localOnlyEnable } from "../enable-result.js";
import { logger } from "../../utils/logger.js";

function apiToken(): string {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    throw new Error("CLOUDFLARE_API_TOKEN environment variable is required.");
  }
  return token;
}

async function cfFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = (await response.json()) as {
    success?: boolean;
    result?: T;
    errors?: { message: string }[];
  };
  if (!response.ok || body.success === false) {
    const msg = body.errors?.[0]?.message || response.statusText;
    throw new Error(`Cloudflare API error: ${msg}`);
  }
  return body.result as T;
}

export class CloudflareAdapter implements ProviderAdapter {
  private accountId: string | null = null;
  private region: string | undefined;

  setRegion(region: string): void {
    this.region = region;
  }

  async init(): Promise<void> {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    await cfFetch<{ id: string; email?: string }>("/user");

    if (accountId) {
      this.accountId = accountId;
    } else {
      const accounts = await cfFetch<{ id: string }[]>("/accounts");
      this.accountId = accounts[0]?.id || null;
    }
    if (!this.accountId) {
      throw new Error(
        "Could not resolve Cloudflare account id. Set CLOUDFLARE_ACCOUNT_ID.",
      );
    }
  }

  async createEnvironment(name: string): Promise<EnvironmentRecord> {
    const now = new Date().toISOString();
    const resources: Record<string, unknown> = {
      createdBy: "sandman",
    };

    const kv = await cfFetch<{ id: string; title: string }>(
      `/accounts/${this.accountId}/storage/kv/namespaces`,
      {
        method: "POST",
        body: JSON.stringify({
          title: `sandman-${name}`,
        }),
      },
    );
    resources.kvNamespaceId = kv.id;
    resources.kvNamespaceTitle = kv.title;

    return {
      name,
      provider: "cloudflare",
      accountId: this.accountId || undefined,
      region: this.region,
      status: "active",
      services: ["kv"],
      resources,
      createdAt: now,
      updatedAt: now,
    };
  }

  async enableServices(
    env: EnvironmentRecord,
    services: ServiceName[],
  ): Promise<EnableResult> {
    const valid = services.filter((s) => CLOUDFLARE_SERVICES[s]);
    const provisioned: ServiceName[] = [];
    const localOnly: ServiceName[] = [];
    const warnings: string[] = [];

    for (const service of valid) {
      if (service === "kv" && env.resources.kvNamespaceId) {
        provisioned.push(service);
        continue;
      }
      if (service === "r2" && this.accountId) {
        try {
          const bucket = await cfFetch<{ name: string }>(
            `/accounts/${this.accountId}/r2/buckets`,
            {
              method: "POST",
              body: JSON.stringify({ name: `sandman-${env.name}` }),
            },
          );
          env.resources.r2Bucket = bucket.name;
          provisioned.push(service);
        } catch (error: unknown) {
          warnings.push(
            `r2 provisioning failed: ${error instanceof Error ? error.message : String(error)}`,
          );
          localOnly.push(service);
        }
        continue;
      }
      localOnly.push(service);
      warnings.push(
        `${service} is not fully provisioned yet; recorded locally.`,
      );
    }

    env.services = [...new Set([...env.services, ...provisioned, ...localOnly])];
    env.updatedAt = new Date().toISOString();

    return {
      mode:
        provisioned.length && localOnly.length
          ? "mixed"
          : localOnly.length
            ? "local-only"
            : "cloud",
      recorded: valid,
      provisioned,
      localOnly,
      warnings: warnings.length ? warnings : undefined,
    };
  }

  async whoami(): Promise<Record<string, string | null | undefined>> {
    return {
      provider: "cloudflare",
      accountId: this.accountId,
      token: process.env.CLOUDFLARE_API_TOKEN ? "set" : "missing",
    };
  }

  async connect(env: EnvironmentRecord): Promise<Record<string, string>> {
    const result: Record<string, string> = {
      provider: "cloudflare",
    };

    if (env.accountId) {
      result.CLOUDFLARE_ACCOUNT_ID = env.accountId;
    }
    if (env.resources.kvNamespaceId) {
      result.CLOUDFLARE_KV_NAMESPACE_ID = String(env.resources.kvNamespaceId);
    }
    if (env.resources.r2Bucket) {
      result.CLOUDFLARE_R2_BUCKET = String(env.resources.r2Bucket);
    }

    return result;
  }

  async destroyEnvironment(env: EnvironmentRecord): Promise<void> {
    logger.info(
      `Cleaning up Cloudflare resources for environment: ${env.name}`,
    );
    if (!this.accountId) {
      return;
    }
    if (env.resources.kvNamespaceId) {
      await cfFetch(
        `/accounts/${this.accountId}/storage/kv/namespaces/${env.resources.kvNamespaceId}`,
        { method: "DELETE" },
      ).catch(() => undefined);
    }
    if (env.resources.r2Bucket) {
      await cfFetch(
        `/accounts/${this.accountId}/r2/buckets/${env.resources.r2Bucket}`,
        { method: "DELETE" },
      ).catch(() => undefined);
    }
  }

  async getStatus(env: EnvironmentRecord): Promise<EnvironmentRecord> {
    return env;
  }
}
