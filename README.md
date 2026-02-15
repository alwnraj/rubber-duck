# Rubber Duck CLI

A Socratic debugging companion that asks questions instead of giving answers.

## Prerequisites

- Node.js 18+
- GitHub Copilot CLI (`copilot`) if you want provider-backed responses

## Installation

```bash
npm install
npm run build
npm link
```

Or run directly:

```bash
node dist/index.js "my API returns 500"
```

## Usage

```bash
# Start a debugging session
rubber-duck "my API returns 500 but only on Tuesdays"

# Continue session
rubber-duck --continue "I checked the logs"

# Provide file context
rubber-duck --context error.log "why is this failing?"

# Pipe context
cat server.log | rubber-duck "what's causing the timeout?"

# Ask for direct answer
rubber-duck --give-up "still failing"

# Show stats / sessions
rubber-duck --stats
rubber-duck --session-list

# Change mode
rubber-duck --mode tough "nothing works"

# Print generated prompt only
rubber-duck --dry-run-prompt --continue "next step"

# Export active session
rubber-duck --export-session ./artifacts/session.json
rubber-duck --export-session ./artifacts/session.json --force

# Reset stats (destructive)
rubber-duck --reset-stats
rubber-duck --reset-stats --yes --non-interactive
```

## Important Flags

- `--output text|jsonl|json`: output format (`text` default)
- `--non-interactive`: disables ANSI art and spinner for scripts/CI
- `--provider copilot`: provider selector
- `--yes`: bypass destructive-action confirmation
- `--force`: allow overwrite for export target

## JSON Output Contracts

- `--output jsonl`
  - emits one JSON event per line
  - common event types: `info`, `warning`, `error`, `provider_result`, `response`, `stats`, `session_list`

- `--output json`
  - emits one final JSON object with:
    - `events`: ordered event list
    - `ok`: boolean
    - `code`: exit code
    - plus operation-specific fields (`response`, `stats`, `sessions`, etc.)

## Quality and Checks

```bash
npm run lint
npm run format:check
npm test
npm run check
```

## Notes

- If `copilot` is unavailable, the CLI falls back to built-in prompts.
- Large context/history is truncated to protect prompt size.
- Corrupt persisted state is auto-recovered to safe defaults with warnings.

## License

MIT
