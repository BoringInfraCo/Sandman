import type { ProviderType, ServiceName } from "../types/index.js";

export interface EnvironmentTemplate {
  id: string;
  description: string;
  services: Partial<Record<ProviderType, ServiceName[]>>;
}

export const BUILTIN_TEMPLATES: EnvironmentTemplate[] = [
  {
    id: "web-app",
    description: "Web application stack with compute, storage, and runtime services.",
    services: {
      aws: ["ec2", "s3", "lambda"],
      gcp: ["compute", "storage", "cloudrun"],
      cloudflare: ["workers", "kv", "r2"],
      vercel: ["functions", "blob"],
    },
  },
  {
    id: "data-pipeline",
    description: "Data pipeline with object storage and messaging.",
    services: {
      aws: ["s3", "lambda"],
      gcp: ["storage", "pubsub", "container"],
      cloudflare: ["r2", "workers"],
      vercel: ["functions", "blob"],
    },
  },
  {
    id: "ai-agent",
    description: "AI agent sandbox with serverless runtime and artifact storage.",
    services: {
      aws: ["lambda", "s3"],
      gcp: ["cloudrun", "artifactregistry"],
      cloudflare: ["workers", "kv", "durable-objects"],
      vercel: ["functions", "edge", "blob"],
    },
  },
];

export function getTemplate(id: string): EnvironmentTemplate | undefined {
  return BUILTIN_TEMPLATES.find((template) => template.id === id);
}

export function templateServices(
  templateId: string,
  provider: ProviderType,
): ServiceName[] {
  const template = getTemplate(templateId);
  if (!template) {
    return [];
  }
  return template.services[provider] ?? [];
}
