# Adventure conversion — Stage 1

Historical Stage 1 notes. The finite-level foundation described here is now
superseded by [endless-world.md](endless-world.md); see that guide for current
section streaming, persistence and camera behaviour.

This stage replaces simulated travel with a hand-built, flat 16,000-pixel world.
It does not add generation, territory AI, structures, rewards, pets or castles.

## Movement and camera

- Player container x/y are world coordinates. The left margin remains 45 pixels;
  the right boundary is world width minus 45. Both characters retain their stats,
  jump/gravity, movement controls, facing and sprite-animation hooks.
- Ground and background rectangles are static world objects covering the level.
  There is no scenery wrapping or automatic scrolling.
- `WorldCamera` bounds the camera to the level and smoothly follows horizontally.
  Travel targets 38% of viewport width in either direction; turning alone does
  not change the camera offset.
  Framing is clamped at the beginning/end. Vertical camera scroll remains zero.
  Camera smoothing can briefly settle after stopping; the world itself never moves.
- Distance measures the furthest forward world X reached beyond the starting
  position, at 32 pixels per displayed metre. Backtracking/retracing ground never
  increases it. Standing/jumping in place does not add distance.
  Difficulty still uses active run time, with the existing formulas and values.
- Camera updates only during active gameplay, so upgrades/interruption/death
  freeze its position. Restart rebuilds the level and resets scroll to zero.

Spatial/presentation values live in `src/game/config/world.ts`.

## Existing systems

Enemies use fixed test-world positions starting at x=1069, spaced 640 pixels
apart. All slot coordinates are recorded at scene creation. A one-viewport buffer on
both sides of the camera prepares unseen occupants before they enter view,
including preparation before the first gameplay render. The camera does not
determine slot coordinates. Existing health/difficulty formulas
are retained. Spatial preparation replaces the old runner spawn interval. Speed metadata is retained but no runner-style
left drift is applied. Survivors stay at their world positions when off-screen;
render culling hides them without deleting them and skips distant contact checks. Each slot is populated once per
run, so defeated enemies do not respawn when the player revisits. There is no
territory AI, pursuit, patrol or procedural placement system.

Projectiles use world positions and camera-relative off-screen cleanup. Sword
hit tests and effects already use world positions. Neither collision size nor
weapon damage/cooldown/range is derived from the camera or artwork.

XP drops stay at their world positions, attract at the existing radius/speed and
use unchanged values, thresholds and upgrades. They no longer drift left on their
own. Drops remain available for backtracking until collected/restart (apart from
the existing absolute negative-world boundary guard).

HUD, touch controls, upgrade cards and results UI use scroll factor zero. Both
containers and interactive children are fixed where needed so pointer targets
stay aligned after travelling away from x=0. Responsive FIT scaling is unchanged.

## Rosie

There is no cage or princess object in the level. The existing princess emoji is
used as a small portrait at the top-right with a speech bubble. Existing
character-specific start, damage, level-up, death and idle lines are retained.

Idle dialogue appears every 12 active seconds; each bubble lasts 3.5 active
seconds. Event reactions show immediately and restart that interval. The existing
scene-clock pause freezes both dialogue and hide timers during upgrades and
interruptions. Shutdown cancels both timers. Level-up and death lines also remain
on their respective overlays. No new portrait asset or cinematic is introduced.

## Validation and browser checklist

Run `node tests/reliability.cjs`, `npx tsc --noEmit` and `npm run build-nolog`.
Focused checks cover world movement/bounds, smooth framing/bounds, relative
spawning, combat beyond the first viewport, stationary XP, fixed overlay/input
coordinates, dialogue visibility/timers and pause/restart cleanup.
The regression scene uses Phaser-shaped mocks; real mobile input/rendering still
needs manual verification.

1. Walk both characters beyond the first screen, turn back, jump and stop. Check
   facing, camera smoothness, no vertical following, and no continuous auto-travel.
2. Backtrack to the left boundary. Reach the far end if desired; the camera should
   never reveal outside the test world. There is no end encounter in this stage.
3. Fight several screens from the start. Check sword range/flipping, Candy shots,
   damage, XP pickups and upgrades. Walk to distant drops instead of waiting for
   them to scroll toward you.
4. Open upgrades and die after panning far right. Check mouse/touch card/restart
   targets, fixed HUD, simultaneous movement/jump/attack and character re-selection.
5. Rotate or switch apps/tabs during travel/attacks/dialogue. Resume without drift,
   stuck input or timer jumps. Verify landscape layout/safe areas on both platforms.
6. Confirm Rosie appears briefly as a fixed portrait/bubble with the correct tone
   for each character, and repeated restarts leave no cages or duplicate bubbles.

## Coordinate and slowdown corrections

The first conversion retained a left/right camera-offset change, camera-relative
runner spawning/despawning, and accumulated walking distance. These have been
removed. World containers explicitly use scroll factor 1; only HUD/portrait/menus/
controls use scroll factor 0. Artwork and collision dimensions are unchanged.

The old update discarded frame time above 50 ms, slowing movement below 20 FPS.
Frames now use bounded substeps of at most 50 ms, consuming up to 250 ms of elapsed
active time. This preserves character speed without an unbounded catch-up loop.
Upgrades or death stop any remaining steps immediately. Pauses still consume no
simulation time. Movement tests compare one second at 60/20/15/8 simulated FPS.

Off-screen scenery is hidden, with visibility recomputed only when the camera
crosses a 160-pixel scenery cell. Roughly 8–10 of the 101 scenery blocks render at
once. Fixed enemy slots also prevent an endless idle stream of enemies and drops.
See `startup-profile.md` for measured startup timing, the Phaser time-smoothing
root cause, and the separate spatial-preparation correction.

### Temporary debug overlay

Enabled by `WORLD.debugOverlay` in `src/game/config/world.ts`. Set it to false to
remove the diagnostics after verification. `WorldDebug` draws screen-fixed text
under the HUD and updates it at most five times per second:

- Player world X.
- Camera scroll X.
- Player screen X = player world X − camera scroll X (internal game pixels).
- Nearest enemy world X (`none` until one exists).
- Measured world speed versus configured speed, using raw browser frame time.
- Camera speed and simulated/real elapsed-time ratio.
- Scene/raw frame milliseconds, engine FPS estimate, prepared/visible enemy counts.

Continuous unobstructed walking should measure about 280 units/s for Llama Crunch
or 350 for Candy without upgrades, with simulated/real time near 1.00x. Short
windows spanning input changes will average that movement. Pauses reset samples.
The engine FPS estimate takes time to settle; raw frame time is more immediate.

For example: player x=2500 and camera scroll x=2110.9 gives screen x=389.1,
approximately 38% of the 1024-pixel viewport. At the beginning/end, world bounds
can prevent that framing. The nearest-enemy value changes when a different enemy
becomes nearest; an individual survivor's world X must never follow camera X.

Verify forward/backward travel, direction changes in place, idle enemy count,
revisiting survivors, distance high-water behaviour and FPS on desktop/mobile.
The camera may briefly finish its smooth follow after stopping; geometry itself
has no automatic movement. No new gameplay systems or artwork were introduced.
