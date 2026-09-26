import { ProviderType } from "../types/index.js";
import {
  AWS_SERVICES,
  CLOUDFLARE_SERVICES,
  GCP_SERVICES,
  VERCEL_SERVICES,
} from "./base.js";

export type ProviderMaturity = "supported" | "experimental";

export interface ProviderInfo {
  id: ProviderType;
  maturity: ProviderMaturity;
  services: string[];
  auth: string;
  notes: string;
}

export const PROVIDER_CATALOG: ProviderInfo[] = [
  {
    id: "aws",
    maturity: "supported",
    services: Object.keys(AWS_SERVICES),
    auth: "aws configure, or AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY",
    notes: "Provisions sandbox resources (S3, VPC, IAM, optional EC2) in an existing AWS account.",
  },
  {
    id: "gcp",
    maturity: "supported",
    services: Object.keys(GCP_SERVICES),
    auth: "gcloud auth application-default login, or GOOGLE_APPLICATION_CREDENTIALS",
    notes: "Creates a GCP project and links billing when a billing account can be resolved. Requires a billing account for APIs to work.",
  },
  {
    id: "cloudflare",
    maturity: "supported",
    services: Object.keys(CLOUDFLARE_SERVICES),
    auth: "CLOUDFLARE_API_TOKEN (+ optional CLOUDFLARE_ACCOUNT_ID)",
    notes: "Provisions KV namespaces and optional R2 buckets in the configured Cloudflare account.",
  },
  {
    id: "vercel",
    maturity: "supported",
    services: Object.keys(VERCEL_SERVICES),
    auth: "VERCEL_TOKEN (+ optional VERCEL_TEAM_ID)",
    notes: "Creates a Vercel project via API. Marketplace services are recorded locally.",
  },
];

export const SERVICES_BY_PROVIDER: Record<ProviderType, string[]> = {
  aws: Object.keys(AWS_SERVICES),
  gcp: Object.keys(GCP_SERVICES),
  cloudflare: Object.keys(CLOUDFLARE_SERVICES),
  vercel: Object.keys(VERCEL_SERVICES),
};

export function getProviderInfo(id: string): ProviderInfo | undefined {
  return PROVIDER_CATALOG.find((p) => p.id === id);
}

export function parseProvider(value: string): ProviderType | undefined {
  const parsed = ProviderType.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function experimentalWarning(id: ProviderType): string | undefined {
  const info = getProviderInfo(id);
  if (info?.maturity !== "experimental") {
    return undefined;
  }
  return `${id} is experimental: ${info.notes}`;
}
