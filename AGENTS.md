# AGENTS.md

## Scope

This fork targets the Windows x64 portable overlay with a managed official Event Bridge. See README.md and docs/local-run.md. Preserve the existing visuals, window behavior and security boundaries.

## Changes and versions

- Every user-facing behavior change must include a Changeset; use minor for new features and substantial behavior changes, patch for fixes and small changes.
- Start the summary with feat:/fix:/perf:/chore: and one short user-facing sentence.
- Docs, CI, tests and behavior-preserving cleanup need no changeset.
- Do not manually bump package.json version, edit CHANGELOG.md or push version tags. Keep Changesets for future versioning; this fork does not automatically publish releases.

## Verification

- Run pnpm typecheck and pnpm lint after code/dependency cleanup.
- Run pnpm test:security after security or bridge changes; it uses the verified official executable prepared with pnpm bridge:prepare.
- Run production pnpm package after build changes. Preserve an existing out directory and its runtime data when checking a cleanup; use a separate validation output directory.
- Keep src/dev fixtures and tests; they verify the unchanged event appearance.
- Never commit executables, caches, runtime profiles or tokens.

## Editing these instructions

CLAUDE.md is a Git symlink to AGENTS.md; edit AGENTS.md.
