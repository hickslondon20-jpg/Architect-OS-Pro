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
- Error: no transport error; the request completed successfully on the standard SDK path.
- Timeline: first Phase E live canary attempt after v0.6.122 deployed.
- Reproduction: create a new Virtual CSO chat, click the Deep Mode toggle, immediately populate and submit the composer.

## Current Focus

- hypothesis: eliminated. The deployed toggle commits before the next interaction, and the request builder serializes the committed state without another conversion seam.
- test: dark deployed UI observation plus persisted-run countability checks.
- expecting: no canary is submitted until `aria-pressed=true` is observed; a run cannot count unless reloaded DB/session evidence proves Phase E.
- next_action: deploy the countability guard dark, then await London's explicit re-arm authorization.
- reasoning_checkpoint: the void run is operator timing because the prior automation never observed the post-click state; no source or deployed reproduction showed a toggle/send defect.
- tdd_checkpoint: focused countability tests cover valid pause, the void 04B-C shape, pointer mismatch, and completed resume.

## Evidence

- timestamp: 2026-07-23T23:23:07Z
  observation: Run 48a2b1c6 recorded `deep_mode=false`, `sdk_phase=04B-C`, and `active_sdk_session_id=null`.
  implication: The run is void for Phase E and proves the backend received a standard-mode request.
- timestamp: 2026-07-28
  observation: On the deployed dark UI, `Deep Mode off` had `aria-pressed=false`; after a toggle-only click it rendered `Deep Mode on` with `aria-pressed=true`.
  implication: The product latch commits normally when the click is observed.
- timestamp: 2026-07-28
  observation: A rapid toggle-then-fill sequence, without submitting a turn, still rendered `Deep Mode on` with `aria-pressed=true`.
  implication: The reported failure did not reproduce as a toggle/state race.
- timestamp: 2026-07-28
  observation: `VirtualCSOWorkspace.sendMessage` passes its `deepMode` state directly and `virtualCsoApi.sendUserMessage` serializes `deepMode: options.deepMode ?? false`.
  implication: There is no intermediate mapping that can convert a committed `true` to `false`.

## Eliminated

- Backend Phase E routing: it correctly selects 04B-E only after receiving Deep Mode true.
- API serialization loss: the boolean is copied directly into the request body.
- Reproducible toggle latch race: both deliberate and rapid dark UI observations latched true.

## Resolution

- root_cause: Canary 1 was submitted without observing that the toggle had latched. The only durable observation is the false request/run; the deployed control and send path do not reproduce a product defect.
- fix: Require a visible `aria-pressed=true` preflight before submission. Add a fail-closed persisted countability verifier and stamp paused SDK runs with `deep_mode=true`, `sdk_phase=04B-E`, and `sdk_session_id`.
- verification: focused unit tests plus build/compile checks; deployed dark verification pending the new release.
- files_changed: `python-backend/services/vcso_chat_service.py`, `python-backend/services/vcso_phase_e_canary.py`, `python-backend/scripts/verify_phase_e_canary.py`, `python-backend/unit_tests/test_vcso_phase_e_canary.py`.
