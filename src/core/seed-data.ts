import type { Config } from "../types/index.js";

export const SEED_CONFIG: Config = {
  version: "1.0.0",
  provider: "aws",
  defaultRegion: "us-east-1",
  operator: {
    name: "seed-operator",
    recordedAt: "2026-01-01T00:00:00.000Z",
  },
  environments: {
    "demo-seed": {
      name: "demo-seed",
      provider: "aws",
      region: "us-east-1",
      status: "active",
      services: ["s3", "ec2"],
      resources: {
        bucketName: "sandman-demo-seed-bucket",
        vpcId: "vpc-seed000000",
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      ttl: "2h",
      expiresAt: "2026-01-01T02:00:00.000Z",
      provenance: {
        actor: "seed-operator",
        harness: "cursor",
        goal: "Deterministic eval fixture",
        recordedAt: "2026-01-01T00:00:00.000Z",
      },
      template: "web-app",
    },
  },
};
