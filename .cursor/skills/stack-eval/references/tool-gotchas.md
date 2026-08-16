# Tool gotchas

Facts discovered through live debugging in this project's environment, where rediscovery is expensive. General knowledge and candidate-specific findings belong elsewhere.

- pnpm 11 blocks postinstall build scripts (esbuild, workerd, sharp, lightningcss, lefthook); merge allowBuilds entries into pnpm-workspace.yaml instead of replacing it.
- create-hono / C3 write the generation date as compatibility_date while the bundled workerd supports only ~2 days earlier (wrangler dev fails to start); pin compatibility_date into workerd's range or update wrangler.
- minimumReleaseAge supply-chain policy rejects freshly published versions at install (ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION); pin the previous passing version and re-bump later.
- TypeScript 6 removed baseUrl; keep paths (relative to the tsconfig file) and do not add baseUrl.
- Worker entry files need a default export, which a strict import/no-default-export rule rejects; add a scoped oxlint override for the entry file only.
- The shadcn CLI can create component files under a literal @/ directory when alias resolution fails; verify components land in the real alias target (e.g. src/components/ui/) after shadcn add.
