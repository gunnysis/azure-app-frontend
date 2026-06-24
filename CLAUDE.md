# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Symbols (function/const names) are the stable anchors — line numbers drift, so grep by name.

## What this is

Frontend MVP for an electricity-bill prediction service branded **"찌릿" (jjirit)**, scoped to **마포구 원룸 1인 가구** (Mapo one-room single-person households). Pure vanilla HTML/CSS/JS — **no framework, no build step, no package manager, no test suite, no dependencies**. UI copy and most code comments are in Korean.

## Run / develop

```bash
# Serves the repo root over http://127.0.0.1:4202 via python -m http.server
start_frontend_server.bat        # Windows
python -m http.server 4202 --bind 127.0.0.1   # equivalent, any OS
```

Then open `http://127.0.0.1:4202/index.html`. Opening `index.html` directly via `file://` also renders, but `fetch` to a backend won't work from `file://`.

There is no lint/build/test tooling, and no JS runtime in this environment (`node` is absent — syntax-check by other means, e.g. a brace-balance scan or a browser). Edits take effect on browser refresh. Static asset links carry a `?v=...` cache-busting query (e.g. `styles.css?v=20260624-deadcode-cleanup`) — bump it when you need clients to re-fetch. For debugging, the app exposes `window.singleEnergyFrontend` (`buildPayload()`, `calculateElectricBill()`, `getPredictEndpoint()`) in the browser console.

## Architecture

Everything is at the repo root: `index.html` (markup for all screens), `styles.css`, and `script.js` (all logic, ~1640 lines, no modules). `config.js` is a small host-aware config seam loaded before `script.js`; `appinsights.js` is the Application Insights init/telemetry seam (see Monitoring) loaded between them. Brand SVGs live in `assets/brand/` (`jjirit-icon.svg`, `jjirit-logo.svg`); display fonts (Moneygraphy) in `assets/fonts/`; the self-hosted App Insights SDK bundle is in `assets/vendor/`.

**Screen wizard.** The UI is a single phone-frame of `<article class="screen">` elements driven by the `screens` array (near the top of `script.js`): `splash → start → airconTime → loading → report` (5 steps; progress shows `n/5`). Navigation is a hand-rolled state machine — `goTo(index)` / `goNext()` toggle the `.active` class and `body[data-current-screen]`. `state` holds the wizard index plus the user's aircon inputs. All DOM references are cached up front in the `els` object. The final `report` screen carries all result figures — there is no separate result screen, and `renderPrediction()` writes only to report/summary elements.

**Input model (aircon-centric).** `buildPayload()` is the single source of the request body. The user supplies: **daily aircon hours** (`aircon_hours_per_day`, 0–24, via slider+number input with pointer/touch drag), **aircon type** (`aircon_type`: `fixed`정속형 / `inverter`인버터 / `unknown`잘모름 / `none`미사용), and optional **power draw** (`aircon_power_w`; empty → `null` = use average; 0 hours → `0`/`none`). `region`("mapo"), `housing_type`("oneroom"), `household_size`(1) are **hardcoded** for this MVP. Setting hours to 0 disables the type/power inputs (`syncAirconPowerState`).

**Prediction flow with mandatory fallback.** This is the core design point. `requestPrediction()` POSTs the payload to `PREDICT_ENDPOINT` with an **8000ms `AbortController` timeout**. **On any failure (timeout, non-2xx, network), it silently falls back to `localMockPredict()`** — a client-side heuristic keyed on hours × power × type-multiplier — so the app always renders a result. Each result carries a `source` tag (`"live"` / `"sample"` / `"fallback"`). A rendered screen does NOT mean the API succeeded — check the console for the `[single-energy] Falling back...` warning and the `source` value.

**Response contract is intentionally minimal.** `normalizePredictionResponse()` requires only `predicted_kwh`; if `estimated_bill` is absent it is computed locally. So the frontend tolerates a partial backend.

**Money is shown as ranges, not point values.** Bills render as `X ~ Y원` via `formatBillRange()` / `formatWonRange()` with `BILL_RANGE_MARGIN` (±5,000, rounded to the nearest 1,000) — this deliberately signals prediction uncertainty. Don't "fix" the UI to a single number without intent.

**Local bill math.** `calculateElectricBill()` is a hardcoded Korean progressive tariff (tiers at 200/400 kWh + climate/fuel/basic + VAT + fund) used both for the fallback and to fill a missing `estimated_bill`. `BASELINE_KWH = 165` is the Mapo single-person benchmark every "vs 기준" figure compares against.

**Report image export.** `createReportImageBlob()` renders the share card to an image with a three-tier fallback: Canvas API → `html2canvas` (only if `window.html2canvas` is present — it is NOT bundled) → inline SVG (drawn via `blob:` URLs). Sharing uses the Web Share API with a download fallback. (CSP must allow `img-src blob:` — see `docs/DEPLOYMENT.md`.)

## API integration

The API base URL is the single environment seam: `window.SINGLE_ENERGY_API_BASE_URL` in `config.js`. `config.js` is loaded before `script.js` and is **host-aware** (recurrence guard from the 2026-06-23 dev mis-deploy): when served from a non-local host (any production / SWA-preview hostname) it **forces the production Azure backend URL** regardless of any pre-set global — so a branch accidentally shipping a `localhost` config can't break the live backend link; only on `localhost`/`127.0.0.1`/`file://` does it fall back to `http://127.0.0.1:8000` (overridable by setting the global before load). `script.js` still defaults to `http://127.0.0.1:8000` if the global is somehow unset. To develop against a local backend, edit `config.js`. The frontend calls `POST {base}/api/v1/estimate` — the backend **adapter** endpoint that accepts the aircon-habit payload, synthesizes the 8 raw ML features (weather lookup + THI + usage estimate), and calls the model. It is key-less (the static frontend can't hold an API key; the backend protects it via CORS-origin whitelist + rate limit). Full request/response shape is in `API_CONTRACT.md`.

Request body (from `buildPayload()`): `region`, `housing_type`, `household_size`, `has_aircon`, `aircon_hours_per_day`, `aircon_power_w` (number | `null` | `0`), `aircon_type`. Response the frontend depends on: `predicted_kwh` (required) + `estimated_bill` (optional).

> This payload is **provisional** — the backend/ML input spec is not finalized (see `docs/DEPLOYMENT.md` §5.2). If fields change, edit `buildPayload()` and keep `API_CONTRACT.md` + the backend schema in sync.

**Backend integration (resolved via adapter):** the earlier path/auth/schema mismatches (frontend `/predict` vs backend `/api/v1/predict`, missing `X-API-Key`, and the user-intent↔raw-ML-feature gap) are bridged by the key-less `/api/v1/estimate` adapter in `azure-app-backend` (`app/api/v1/adapter.py` + `app/services/feature_builder.py`). The one operational requirement is the backend's `CORS_ORIGINS` must include the SWA origin. Caveat: `prev_year_usage`/`current_usage` fed to the model are *estimates* (the frontend doesn't collect metered usage) — see `API_CONTRACT.md` §6. See `docs/POST_DEPLOY_REVIEW.md` §3 for the reconciliation history.

## Deployment

Target is **Azure Static Web Apps Standard** (pure static, no build). Deployment is **live and automated**: `.github/workflows/azure-static-web-apps-thankful-desert-0cdb08500.yml` deploys to Azure SWA on every push to `main` (and creates preview environments for PRs), with `skip_app_build: true` / empty `output_location` since there is no build step. So merging to `main` ships to production.

`staticwebapp.config.json` lives at the **repo root** (not just documented in `docs/`): it does SPA-style `navigationFallback` to `/index.html`, caches `/assets/*` for a year, and sets the security headers + CSP. The CSP is the constraint that shapes a few code decisions — `script-src 'self'` (no inline scripts, no CDN, which is why `html2canvas` cannot be loaded and is not bundled), `img-src 'self' data: blob:` (needed for the report-image export), and `connect-src` is pinned to `'self'` + the production backend host + the **Application Insights ingestion endpoint** (so changing the backend URL or recreating the App Insights resource in another region means updating both `config.js` **and** the CSP `connect-src` — see Monitoring).

Full operational runbook — resource info, GitHub-connection prerequisite, CORS, and the backend-contract mismatches — is in `docs/DEPLOYMENT.md`; `docs/POST_DEPLOY_REVIEW.md` is the post-deploy verification log. Set the production backend HTTPS URL in `config.js` before deploying.

## Monitoring (Application Insights — browser RUM)

Observability is **client-side Real User Monitoring** via Application Insights, not server logs. SWA's native App Insights integration only covers a *managed API* (which this app doesn't have — the backend is a separate Azure Web App), so meaningful telemetry comes from the **browser JS SDK**. Because the CSP forbids CDN/inline scripts (`script-src 'self'`), the SDK is **self-hosted**: `assets/vendor/ai.3.4.1.gbl.min.js` (pinned version, SRI-checked in `index.html`) + `appinsights.js` (the init seam). The Azure resources are `appi-frontend-prod-kc-02` (App Insights, workspace-based) + `log-frontend-prod-kc-02` (Log Analytics) in RG `project-1st-team-3` / `koreacentral`.

- **Connection string** is injected by `config.js` (prod hosts only — local dev sends nothing) into `window.SINGLE_ENERGY_APPINSIGHTS_CONNECTION_STRING`. It is **not a secret** (browser-visible by design, per Microsoft) so it lives in committed config.
- **Telemetry is best-effort** — `appinsights.js` no-ops if the connection string is unset or the SDK global is missing, and it logs a `[single-energy]` warning if the string is present but the SDK didn't load (SRI mismatch / bundle 404 → recurrence guard). It never affects app behavior.
- **Custom events** flow through the `window.singleEnergyTrack(name, props)` / `window.singleEnergyTrackPage(name)` seam (defined in `appinsights.js`, called defensively from `script.js`): `screen:*` page views (the splash→…→report funnel) and `prediction_result` (carries `source` = `live`/`sample`/`fallback` — the real-world fallback-rate metric that makes the "fallback opacity" measurable).
- **CSP coupling:** the SDK's ingestion endpoint (from the connection string's `IngestionEndpoint`, currently `https://koreacentral-0.in.applicationinsights.azure.com`) must be in `connect-src`. The SDK itself is `'self'` (self-hosted) so `script-src` needs no change. Updating the SDK = replace the versioned file in `assets/vendor/` + update the `integrity` hash in `index.html`.
