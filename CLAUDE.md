# QAQC_dashboard

Nuxt 4 SSR dashboard for the OOI Regional Cabled Array, deployed to EC2 behind
Caddy. It renders QAQC plot images, acoustic spectrograms/echograms, discrete
sample data and HITL notes, all proxied from S3.

```
dashboard/          the Nuxt app (work here)
  app/              client: pages, components, Pinia store
  server/           Nitro: S3 proxy, archives, auth, SQLite
scripts/            discrete sample data pipeline — see scripts/README.md
.github/workflows/  dispatch jobs that hand work to Prefect
```

## Node 20 or newer, always

On Node 16 the Vue language server fails to load `@vue-macros/nuxt/volar` and
reports **phantom type errors on every `$ref`/`$computed` variable** — errors
`vue-tsc` does not reproduce. If the IDE flags something the CLI does not,
check `node -v` before believing it.

CI builds on Node 24. There is no `.nvmrc`, so set the version yourself.

## Verifying a change

```sh
cd dashboard
npm run lint     # nuxi typecheck && eslint . && prettier --check .  (what CI runs)
npm run fix      # eslint --fix . && prettier --write .
npm test         # vitest, server-side only
```

`npm run lint` must pass before committing. Prettier is enforced, and eslint
has `max-len` at 100 — long Tailwind class strings usually need to become a
`:class="[...]"` array.

Adding an export to `server/utils/` requires `npx nuxi prepare` before
typecheck sees it; Nitro auto-imports from a generated registry.

## Things that bite

**Reactivity Transform.** `app/` uses `$ref`/`$computed`/`$$` (18 files). It is
deprecated upstream. Follow the surrounding style rather than mixing idioms, and
note a `$ref` that gets reassigned must be declared `let`, not `const`.

**Plot filename grammar.** Parse from the *end* — `variable` can contain
underscores (`spectral_irradiance_412nm`), so positional splitting from the
front silently misaligns every later field. Use `app/plotFilename.ts`.

```
<refDes>_<variable>_[<NNNmeters|NNNprofile>_]<timeSpan>_<overlay>_<dataRange>.<png|svg>
```

**The plot index is a manifest, not a listing.** The client reads
`QAQC_plots/index.json`; a plot present in S3 but absent from the index is
invisible. After a pipeline adds new filenames, `qaqc_index --cloud` must run.

**Never say "not found" before a fetch resolves.** The index is large and S3
images are 0.5–2 MB, so an unresolved request looks identical to missing data.
Use a tri-state and the delayed-spinner pattern in `Overview.vue` /
`AcousticViewer.vue`: a `.-delayed` overlay stays invisible for 400 ms so fast
loads never flash.

**Content types.** `server/utils/s3-proxy.ts` derives Content-Type from the file
extension, because the pipelines upload without one and S3 reports
`binary/octet-stream`, which stops Caddy compressing. That one header is the
difference between 6.3 MB and 260 KB for `index.json`.

## Where data comes from

- **S3 prefixes** (proxied by `server/middleware/02.s3-proxy.ts`): `QAQC_plots/`,
  `spectrograms/`, `echograms/`, `discrete/`, `HITL_notes/`, `archives/`.
  `archives/internal/` requires auth.
- **Instrument config** is the `params/` directory of
  [rca-data-tools](https://github.com/OOI-CabledArray/rca-data-tools/tree/main/rca_data_tools/qaqc/params) —
  `sitesDictionary.csv`, `variableMap.csv`, `eventPresets.csv`. Event Report
  fetches these at runtime, so instrument lists change without a deploy.
- **Archives** are S3-to-S3 snapshots of `QAQC_plots/`. Internal archives are
  overwritten by hand for staging previews, so they are not immutable.

## Deploys

Push to `main` builds and ships to EC2. The service must be `enable`d or it will
not survive a reboot — it once sat dead for two days behind a green deploy.
Scheduling lives in Prefect; the workflows here only dispatch.
