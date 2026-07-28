---
status: resolved
trigger: "Canary 1 submitted as deep_mode=false after the Deep Mode toggle was clicked; determine operator timing versus a real toggle-to-submit race and add a countability guard."
created: 2026-07-28
updated: 2026-07-28
---

# Deep Mode Toggle Latch

## Symptoms

- Expected: clicking `Deep Mode off` changes the next submitted request to `deepMode=true`, selecting Phase E.
- Actual: live canary run `48a2b1c6-830a-4a4e-aa52-6cffe5a46852` persisted `deep_mode=false`, `sdk_phase=04B-C`, no SDK session pointer, no todos, and no workspace files.
- Actual, corrected 2026-07-28: from a brand-new chat, the enabled `Deep Mode off` button remained `aria-pressed=false` after click. No turn was submitted during this reproduction.
- Error: no transport error; the request completed successfully on the standard SDK path.
- Timeline: first Phase E live canary attempt after v0.6.122 deployed.
- Reproduction: create a new Virtual CSO chat, click the Deep Mode toggle, immediately populate and submit the composer.

## Current Focus

- hypothesis: confirmed. `VirtualCSOWorkspace` renders two Composer branches; only the established-thread branch supplied the controlled `deepMode` value and `onDeepModeChange` callback.
- test: assert every Workspace Composer branch carries both Deep Mode control props, then verify a deployed brand-new chat changes `aria-pressed=false` to `true`.
- expecting: the pre-fix structural test fails on the new-chat Composer and passes after the two missing props are wired.
- next_action: hold for London's decision on UI end-to-end versus a decoupled deterministic Deep Mode canary path.
- reasoning_checkpoint: the earlier green exercised the established-thread Composer. The new-chat Composer used its local defaults (`deepMode=false`, undefined callback), so the button was inert by construction; no async thread race is required.
- tdd_checkpoint: RED reproduced the missing `deepMode` attribute in the first Composer; GREEN passed after wiring both controlled props.

## Evidence

- timestamp: 2026-07-23T23:23:07Z
  observation: Run 48a2b1c6 recorded `deep_mode=false`, `sdk_phase=04B-C`, and `active_sdk_session_id=null`.
  implication: The run is void for Phase E and proves the backend received a standard-mode request.
- timestamp: 2026-07-28
  observation: On the deployed dark UI, `Deep Mode off` had `aria-pressed=false`; after a toggle-only click it rendered `Deep Mode on` with `aria-pressed=true`.
  implication: The product latch commits normally when the click is observed.
- timestamp: 2026-07-28
  observation: A rapid toggle-then-fill sequence, without submitting a turn, still rendered `Deep Mode on` with `aria-pressed=true`.
  implication: This exercised the established-thread Composer and did not cover the new-chat branch.
- timestamp: 2026-07-28
  observation: `VirtualCSOWorkspace.sendMessage` passes its `deepMode` state directly and `virtualCsoApi.sendUserMessage` serializes `deepMode: options.deepMode ?? false`.
  implication: There is no intermediate mapping that can convert a committed `true` to `false`.
- timestamp: 2026-07-28
  observation: The fresh/new-chat Composer omitted `deepMode={deepMode}` and `onDeepModeChange={setDeepMode}`, while the established-thread Composer supplied both.
  implication: The new-chat button always rendered the default off state and its click handler had no parent callback to invoke.
- timestamp: 2026-07-28
  observation: The new structural regression test failed before the fix with `expected [...] to include 'deepMode'` and passed after both props were added.
  implication: The test reproduces and locks the exact branch-specific wiring defect.
- timestamp: 2026-07-28
  observation: Cache-busted `/api/health` returned `ok=true` at `951e7d30`; Railway and Vercel both reported success.
  implication: The observed UI proof ran against the deployed v0.6.124 repair.
- timestamp: 2026-07-28
  observation: In a brand-new deployed chat, the enabled control changed from `aria-pressed=false` / `Deep Mode off` to `aria-pressed=true` / `Deep Mode on`, then was returned to off without submitting a prompt.
  implication: The exact new-chat defect is repaired live while the canary remains dark.

## Eliminated

- Backend Phase E routing: it correctly selects 04B-E only after receiving Deep Mode true.
- API serialization loss: the boolean is copied directly into the request body.

## Resolution

- root_cause: The new-chat render branch did not pass the controlled Deep Mode value or setter into `Composer`. Its visible button used `Composer` defaults (`false` plus no callback), unlike the established-thread branch.
- fix: Supply `deepMode={deepMode}` and `onDeepModeChange={setDeepMode}` to the new-chat Composer. Retain the fail-closed countability verifier.
- verification: branch-specific RED/GREEN regression passed; 14 focused VCSO frontend tests and the production build passed; deployed brand-new-chat latch passed at `951e7d30`.
- files_changed: `pages/ProSuite/virtual-cso/VirtualCSOWorkspace.tsx`, `pages/ProSuite/virtual-cso/VirtualCSOWorkspace.test.ts`.
