# SDK release

The SDK package name remains `@xdev/browser-print`. The release workflow prepares
public npmjs publishing after the GitHub Release, independently of the Chrome Web
Store job. **Public registry and license approval remain pending.** The publish
job refuses `UNLICENSED`; do not change the license without owner approval. If the
owner chooses private GitHub Packages, revise the registry, scope/authentication
and provenance requirements before enabling publication.

Before the first public release:

1. Confirm team ownership/publish rights for the npm `@xdev` scope.
2. Approve the SDK license, update its package metadata and include the license
   text covering the bundled core/shared-types code.
3. Confirm the GitHub repository is public and matches `repository.url` exactly.
   npm provenance requires a public source repository.
4. Create the GitHub `npm` environment with required reviewers. Add `NPM_TOKEN`
   as an environment secret, using a granular npm publish token with appropriate
   package/scope permissions and 2FA bypass. Never commit credentials.
5. Set SDK and extension package versions to the same new version, install with
   the frozen lockfile, build, then run `pnpm check:sdk-package vX.Y.Z`.
6. After normal review/merge, an authorized maintainer pushes `vX.Y.Z`. Approve
   the npm environment only after reviewing the release. npm versions are
   immutable; choose a fresh version for every attempt that actually publishes.
7. Confirm the npm package version and provenance, and install it in an external
   consumer to check ESM, CommonJS, TypeScript and the optional React entry.

CI builds the SDK and runs `npm pack --dry-run` via `pnpm check:sdk-package`.
This verifies export files, README, declarations without unpublished workspace
imports, dependency ranges and SDK/extension/tag agreement. It does not prove
registry permissions or that publication succeeded. No tag has been published
as part of T10's local verification.

References: [npm provenance](https://docs.npmjs.com/generating-provenance-statements/),
[scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/).
