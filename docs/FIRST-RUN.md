# Sandman first run

## Install

```bash
npm install -g @itssergio91/sandman
# or
curl -fsSL https://boringinfra.company/sandman/install.sh | sh
```

## Record yourself

```bash
sandman
```

## Guided environment

```bash
sandman init gcp --use-gcloud --billing-account <id>
sandman up --provider gcp --name demo --template web-app
```

## Agent setup

```bash
sandman connect-agent --harness cursor
sandman mcp serve
```

## Inspect and hand off

```bash
sandman doctor --harness cursor --json
sandman handoff demo --to cursor --json
sandman view
```

## Clean up

```bash
sandman destroy demo -y --json
```
