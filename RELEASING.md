# Releasing Rubber Duck CLI

## 1. Pre-release checks

```bash
npm ci
npm run check
```

## 2. Verify package contents

```bash
npm pack --dry-run
```

Confirm tarball includes only intended files (`dist`, `README.md`, `RELEASING.md`).

## 3. Version bump

```bash
npm version patch   # or minor/major
```

## 4. Publish

```bash
npm publish
```

## 5. Post-release smoke test

```bash
npx rubber-duck-cli --non-interactive --output json "smoke test"
```

## Rollback notes

- If publish was incorrect, deprecate the version:

```bash
npm deprecate rubber-duck-cli@<bad-version> "Deprecated due to release issue"
```

- Publish a fixed patch version after `npm run check` is green.
