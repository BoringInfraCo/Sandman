# Sandman CLI machine contract (`sandman.cli.v1`)

This document specifies the stable machine interface for the Sandman CLI.

## Invocation model

- `--json` is supported on all primary commands.
- JSON mode writes exactly one JSON document to stdout per invocation.
- Process exit code `0` means success; `1` means failure.
- stderr remains reserved for human diagnostics in text mode.

## Envelope

```jsonc
// success
{ "schema": "sandman.cli.v1", "command": "list", "success": true, "code": "OK", ... }

// failure
{ "schema": "sandman.cli.v1", "command": "create", "success": false, "code": "NOT_FOUND", "error": "...", "hint": "...", "next": ["..."] }
```

## Determinism

- Persisted timestamps (`createdAt`, `updatedAt`, `expiresAt`) are stored values.
- CLI-generated envelopes do not add random fields.
- Large `resources` and `warnings` arrays may include a `budget` object describing truncation.

## Error codes

| Code | Meaning |
| --- | --- |
| `OK` | Success |
| `NOT_FOUND` | Environment or checkpoint missing |
| `ALREADY_EXISTS` | Environment name already active |
| `NO_PROVIDER` | Provider not initialized |
| `INVALID_PROVIDER` | Unknown provider |
| `INVALID_NAME` | Invalid environment name |
| `INVALID_SERVICE` | Unknown service for provider |
| `AUTH_REQUIRED` | Missing or invalid cloud credentials |
| `CONFIRMATION_REQUIRED` | Destructive action needs `-y` in JSON mode |
| `PARTIAL` | Create finished with partial/failed resources |
| `EXPIRED` | Environment TTL elapsed |
| `INVALID_TTL` | Unparseable TTL duration |
| `INVALID_INPUT` | Argument present but invalid |
| `UNSUPPORTED` | Valid syntax but not implemented |
| `STATE_CORRUPT` | Local state file invalid |
| `STATE_LOCKED` | Another Sandman process holds the lock |
| `PROVIDER_ERROR` | Cloud API failure |
| `INTERNAL` | Unexpected failure |

## Compatibility rules

1. Adding fields is not a breaking change.
2. Removing or renaming fields requires bumping `schema` to `sandman.cli.v2`.
3. Error codes are only added to, never removed.
