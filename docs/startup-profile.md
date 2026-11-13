# Startup simulation and enemy preparation investigation

## Measured cause before editing

Profiled the actual Vite game in an isolated headless Chrome instance, using
Chrome DevTools Protocol, a 1024 × 768 viewport, Llama Crunch, continuous right
input and no upgrades. Measured wall time, raw engine delta, scene delta, player
world displacement, run time, object counts and subsystem execution times over
8.5 seconds. Profiling access was injected into the entry module in browser memory;
no profiling globals were added to shipped code. This browser delivered about
30 frames/second throughout; results are a reproduction, not a mobile benchmark.

| Measurement | Before | After |
| --- | --- | --- |
| Raw frame time | ~33.3 ms | ~33.3 ms |
| Scene delta, early run | ~16.7 ms | ~33.3 ms |
| Early steady walking speed | 140 units/s (seconds 2–4) | ~280 units/s |
| Late walking speed | ~280 units/s | ~280 units/s |
| First movement frame after fix | — | 280 units/s |
| Simulation / real time, early steady run | 0.50x | ~1.00x |
| Initial enemy sprites | 0 | 2, outside viewport |

Final frame-aligned verification: first frame raw/scene delta both 33.3 ms;
first one-second sample 281.2 units/s, second 280.2, last 280.0. Small wall-time
sample variation comes from callback scheduling; displacement per raw frame time
is 280 from the first frame. Starting configured speed remains 280 throughout.

Installed Phaser 4.0.0 `src/core/TimeStep.js` defaults to `smoothStep: true`, a
60 FPS target and `panicMax: 120`. `resetDelta()` starts a 120-frame cooldown;
`smoothDelta()` clamps each cooldown frame to the target's 16.7 ms, then averages
history. At steady 30 FPS this throws away half the elapsed time for roughly four
seconds, followed by a history ramp. It also occurs after focus resets. Our
bounded substeps were correctly integrating the delta they received, but could
not recover time Phaser had already removed. Character stats, distance and camera
easing were not changing player speed. The camera's initial bounded position is
separate from actual world displacement.

Assets completed loading before the gameplay scene. Baseline scene creation took
134.5 ms once, with 115 top-level objects (101 scenery blocks), and zero enemies.
Across the baseline run, cumulative measured player/camera/enemy/XP/HUD/debug work
was about 5.2/2.7/11.7/0.3/42/24 ms respectively; no multi-second workload explained
the exact half-speed period. Animation selection remains in player updates;
texture fetching and scenery construction are not repeated each gameplay frame.
HUD/debug maximum baseline calls were about 1.5 ms. These are JavaScript execution
measurements, not GPU timing. The fixed scene created 117 objects including two
prepared enemies, rising to 120/five enemies after 8.5 seconds. No unrelated
asset, animation, HUD or scenery optimisation was made.

## Targeted fixes

- Disable engine delta smoothing in game configuration. Keep the existing
  50 ms bounded movement steps and 250 ms maximum catch-up; long stalls remain
  bounded. Camera framing, character speeds and all balance values are unchanged.
- Record deterministic test-level enemy positions at construction. Prepare sprites
  immediately and within one viewport beyond both camera edges on every active
  update, replacing the old timed runner spawn gate and 45-pixel lookahead. That
  gate could delay creation until an enemy was visibly inside the camera.
- Keep survivor objects/health and defeated-slot records until scene shutdown.
  Only near-camera occupants render or receive contact checks. Farther slots are
  numbers, not sprites. No new AI, respawn or world generation was added.
  Existing difficulty/health formulas remain evaluated when an occupant is
  prepared; earlier preparation replaces timed creation intentionally.
- Extend the temporary five-Hz debug overlay with raw-time measured world speed,
  configured speed, camera speed, simulation/real-time ratio, raw/scene delta and
  prepared/visible counts. Reset samples on phase changes to exclude pause gaps.

## Verification

TypeScript, reliability tests and production build pass. Added checks cover the
engine smoothing setting, both characters' identical early/late 30 FPS movement,
raw-time diagnostics that detect 0.5x simulation, pre-render enemy preparation,
creation outside view, nearby contact processing, survivor health, defeated-slot
persistence and shutdown cleanup. Existing combat/XP/upgrade/mobile-input checks
also pass. The browser profile verifies the engine timing beyond mocked tests.

Manual checks: hold a direction immediately after starting and again later;
expect 280 units/s for Crunch or 350 for Candy without upgrades and ~1.00x
simulation time. Check smooth entry of bread at screen edges, return to wounded
survivors and defeated locations, fight/collect XP/upgrade, restart, switch tabs,
and rotate/resume on mobile. The FPS estimate settles slowly; use raw delta for
immediate frame timing. Diagnostics remain enabled via `WORLD.debugOverlay`.
