import { ProviderAdapter, VERCEL_SERVICES } from "../base.js";
import {
  EnableResult,
  EnvironmentRecord,
  ServiceName,
} from "../../types/index.js";
import { localOnlyEnable } from "../enable-result.js";
import { logger } from "../../utils/logger.js";

function vercelToken(): string {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    throw new Error("VERCEL_TOKEN environment variable is required.");
  }
  return token;
}

function teamQuery(): string {
  const teamId = process.env.VERCEL_TEAM_ID;
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
}

async function vercelFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`https://api.vercel.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${vercelToken()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = (await response.json()) as T & {
    error?: { message?: string };
  };
  if (!response.ok) {
    const msg = body.error?.message || response.statusText;
    throw new Error(`Vercel API error: ${msg}`);
  }
  return body;
}

export class VercelAdapter implements ProviderAdapter {
  private teamId: string | null = null;
  private region: string | undefined;

  setRegion(region: string): void {
    this.region = region;
  }

  async init(): Promise<void> {
    await vercelFetch<{ user: { username?: string } }>("/v2/user");
    const teamId = process.env.VERCEL_TEAM_ID;
    if (teamId) {
      this.teamId = teamId;
    }
  }

  async createEnvironment(name: string): Promise<EnvironmentRecord> {
    const now = new Date().toISOString();
    const projectName = `sandman-${name}`;
    const created = await vercelFetch<{ id: string; name: string }>(
      `/v9/projects${teamQuery()}`,
      {
        method: "POST",
        body: JSON.stringify({
          name: projectName,
          framework: null,
        }),
      },
    );

    return {
      name,
      provider: "vercel",
      projectId: created.id,
      region: this.region,
      status: "active",
      services: [],
      resources: {
        projectId: created.id,
        projectName: created.name,
        createdBy: "sandman",
      },
      createdAt: now,
      updatedAt: now,
    };
  }

  async enableServices(
    env: EnvironmentRecord,
    services: ServiceName[],
  ): Promise<EnableResult> {
    const valid = services.filter((s) => VERCEL_SERVICES[s]);
    logger.info(`Enabling Vercel services: ${valid.join(", ")}`);
    return localOnlyEnable(
      "vercel",
      valid,
      "Vercel services are recorded locally; marketplace resources such as Postgres/Blob require separate provider setup.",
    );
  }

  async whoami(): Promise<Record<string, string | null | undefined>> {
    return {
      provider: "vercel",
      teamId: this.teamId,
      token: process.env.VERCEL_TOKEN ? "set" : "missing",
    };
  }

  async connect(env: EnvironmentRecord): Promise<Record<string, string>> {
    const result: Record<string, string> = {
      provider: "vercel",
    };

    if (env.projectId) {
      result.VERCEL_PROJECT_ID = env.projectId;
    }
    if (env.resources.projectName) {
      result.VERCEL_PROJECT_NAME = String(env.resources.projectName);
    }
    if (process.env.VERCEL_TEAM_ID) {
      result.VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
    }

    return result;
  }

  async destroyEnvironment(env: EnvironmentRecord): Promise<void> {
    logger.info(`Cleaning up Vercel resources for environment: ${env.name}`);
    const projectId = env.projectId || env.resources.projectId;
    if (!projectId) {
      return;
    }
    await vercelFetch(`/v9/projects/${projectId}${teamQuery()}`, {
      method: "DELETE",
    }).catch(() => undefined);
  }

  async getStatus(env: EnvironmentRecord): Promise<EnvironmentRecord> {
    return env;
  }
}
