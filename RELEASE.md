# Release checklist

Publishing is a human action: `bun publish` asks for npm authentication (and a one-time password
when 2FA is enabled). Everything before that is automated and verified.

## Prerequisites (one-time)

1. Create the **`temples` organization** on <https://www.npmjs.com/org/create> (profile picture →
   Add an Organization, then the free "Unlimited public packages" plan). One organization carries the
   `@temples` scope for all four packages. There is no namespace per package.
2. Log in locally: `bunx npm login` (Bun reads the credentials from `.npmrc` / bunfig.toml).

A direct publish requires 2FA on the account. `bun publish` asks for the one-time password.

## Pre-publish gate

Run from the repository root. Every command must pass before publishing:

```sh
bun install
bun run check        # Biome format + lint
bun run typecheck    # tsc --noEmit
bun test             # all package tests, including the docs build smoke test
bun run build        # builds every package in dependency order
```

Verify what would be shipped, per package:

```sh
cd packages/engine      && bun publish --dry-run && cd ../..
cd packages/components  && bun publish --dry-run && cd ../..
cd packages/ssr         && bun publish --dry-run && cd ../..
cd packages/jquery      && bun publish --dry-run && cd ../..
```

Check the file list: `package.json`, `README.md`, `LICENSE`, and the `dist/` outputs only. No
sources, no tests.

### License file

The root `LICENSE` is the canonical MIT license. npm and Bun pack only a license file that sits
inside the package directory, so each package holds an identical copy of it. When the root
`LICENSE` changes, update the four copies in the same change.

## Publish

Packages publish in dependency order. `bun publish` replaces the `workspace:^` specifier with the
caret range of the version already published (`"workspace:^"` → `"^1.0.0"`), so `engine` must be
published first:

```sh
bun run publish:all
# equivalent to, in order:
#   cd packages/engine     && bun publish
#   cd packages/components && bun publish
#   cd packages/ssr        && bun publish
#   cd packages/jquery     && bun publish
```

Scoped packages publish with `publishConfig.access: "public"` (already set in every
`package.json`).

## After publishing

1. Verify the four pages on npmjs.com (README renders, correct files).
2. Verify `npm view @temples/engine version` reports the new version.
3. Push a git tag: `git tag v1.0.0 && git push origin v1.0.0`.
