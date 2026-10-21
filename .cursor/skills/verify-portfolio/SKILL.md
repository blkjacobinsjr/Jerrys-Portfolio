---
name: verify-portfolio
description: Verify Jerry Doughan's Astro portfolio through its production build, Playwright user journeys, accessibility, performance, and full npm QA gate. Use after changing portfolio content, drawers, models, recommendations or motion.
---

# Verify the portfolio

The maintained gate is `npm run qa`. A helper or targeted test does not replace it. Never reduce thresholds, skip a failed journey or delete assertions to get green. No push or deployment is authorized by verification.

## Launch

Run from the repository root with the installed Node version satisfying package.json and dependencies from package-lock.json. No account, database, seed or environment key is needed. Logos and portraits are local; PUBLIC_LOGO_DEV_TOKEN is optional.

```sh
./.cursor/skills/verify-portfolio/scripts/verify.sh launch
```

The helper builds the real Astro site and starts an owned preview at `http://127.0.0.1:4322`, using `--ignore-lock` to preserve an existing preview at 4321. Ready means `Doctor passed`, not just an open port. The runtime claim `.agent-local/verify-portfolio/` prevents concurrent writers; a second launch refuses. Do not drive an unrelated browser or preview.

## Doctor

```sh
./.cursor/skills/verify-portfolio/scripts/verify.sh doctor
```

This checks the recorded PID owns port 4322, HTTP returns 200, the page identifies Jerry Doughan and the canonical URL is `https://jerrydoughan.com/`. Read `reports/verification/portfolio/server.log` on failure. Never fix a stale preview by killing processes by name.

## Drive

Read [features/README.md](features/README.md) and the matching feature recipe first.

```sh
./.cursor/skills/verify-portfolio/scripts/verify.sh drive
BASE_URL=http://127.0.0.1:4322 npx playwright test tests/e2e/revamp.spec.ts --project=desktop --project=mobile --workers=1
```

The helper exercises Scenaryo at 390px with the production code: open its actual card, expand the drawer, scroll to the CTA and verify its destination and bottom space. Repo specs cover models, network failures, wheel navigation, recommendations and motion through real user events. Network interception is allowed at external browser boundaries to reproduce chunk, image or WebGL failures. Never set private component state to manufacture success.

Run the entire gate against current source before final completion:

```sh
mkdir -p reports/verification/portfolio
npm run qa > reports/verification/portfolio/qa.log 2>&1
qa_status=$?
printf '%s\n' "$qa_status" > reports/verification/portfolio/qa.exit
cat reports/verification/portfolio/qa.log
test "$qa_status" -eq 0
```

It runs Astro/TypeScript checks, Vitest with coverage, Stryker mutation tests, a production build, all Playwright/BDD/perf projects, and five Lighthouse runs for each of mobile and desktop. Preserve coverage 100% lines/statements/functions and 95% branches; mutation break 90; all Lighthouse categories minimum 100. Keep browser performance checks isolated from concurrent browser work.

## Evidence

The helper writes `doctor.json`, `listener.txt`, `drive.json`, `scenaryo-390.png`, `scenaryo-390.aria.yml`, build and server logs under `reports/verification/portfolio/`. Drive evidence names the action and visible result and records the actual link target and pre-interaction model request count. On failure it retains `failure.png`.

Repo evidence lives under `reports/coverage/`, `reports/mutation/`, `reports/e2e/`, `reports/lighthouse/`, `reports/lighthouse-desktop/` and `test-results/`. Save full QA stdout and its exit code under `reports/verification/portfolio/`. Report each stage's actual result, test counts, mutation score, all Lighthouse categories and the final commit. A prepared test or passing build does not prove execution or deployment. Do not claim a physical-device check from browser emulation.

## Cleanup

```sh
./.cursor/skills/verify-portfolio/scripts/verify.sh cleanup
```

Always run cleanup after a drive, including a failed one. It checks and stops only the recorded preview PID, then releases its runtime claim. It preserves evidence and does not stop the user's 4321 preview. Confirm `reports/verification/portfolio/drive.json` and screenshots still exist after cleanup.

## Helpers

`verify.sh` is the executable launch/doctor/drive/cleanup interface. It invokes executable `scripts/prove.mjs` for HTTP and Playwright proof. Do not run prove.mjs against a server not owned by the helper. Keep this map current when flows change; `/maintain-verification-skill` is the maintenance workflow.
