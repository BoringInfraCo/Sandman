# Sandman architecture

Sandman is a CLI-first orchestration layer over cloud provider APIs with local JSON state.

## Layers

1. **CLI** (`src/cli/`) — Commander commands, JSON contract, reap, secrets, handoff, MCP, viewer
2. **Core** (`src/core/`) — `StateStore`, checkpoints, seed fixtures
3. **Providers** (`src/providers/`) — AWS, GCP, Cloudflare, Vercel adapters
4. **Templates** (`src/templates/`) — Built-in environment recipes
5. **MCP** (`src/mcp/`) — stdio tool surface for agents

## State

- Primary config: `~/.sandman/config.json`
- Checkpoints: `~/.sandman/checkpoints/<env>.json`
- Handoffs: `~/.sandman/handoffs/`
- Combie links: `~/.combie/sandman-links/`
- MCP capabilities: `~/.sandman/mcp.toml`

## Safety model

- Zod-validated state with file locking and atomic writes
- Corrupt state refuses overwrite
- Destroy requires confirmation (or `-y` in JSON mode)
- TTL lazy-reap on status/connect/enable/doctor
- Provider destroy guards (GCP `sandman-` prefix, AWS ownership tags)

## Agent interfaces

- `--json` on all commands (`sandman.cli.v1`)
- `sandman mcp serve` for tool discovery
- `sandman handoff` for cross-harness continuation packages
- `sandman doctor --harness` for readiness checks
