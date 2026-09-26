# Sandman operator runbook

## Diagnostics

```bash
sandman doctor --json
sandman doctor --reap --json
sandman doctor --harness cursor --json
```

## Deterministic fixture

```bash
sandman seed --reset --json
```

## Portfolio integrations

```bash
sandman link demo --combie --json
sandman verify demo --json
```

## MCP capabilities

Create `~/.sandman/mcp.toml`:

```toml
allow = ["read", "provision"]
```

Omit `destroy` to block destructive MCP tools.

## Viewer

```bash
sandman view --host 127.0.0.1 --port 9420
```

Loopback only unless `--allow-remote` is passed explicitly.
