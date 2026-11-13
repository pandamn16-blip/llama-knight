# Endless flat-world foundation

The 16,000-pixel right boundary is removed. Players keep their existing movement,
left boundary, jump/gravity, visuals and combat. Camera framing remains 38%, with
unchanged smoothing. Camera bounds grow ahead of travel without resetting scroll.
Distance remains a high-water mark of forward progress; backtracking adds nothing.

## Sections and configuration

`world/sections.ts` generates plain section descriptions with an index, world
start/end, derived seed, scenery positions and bread placements. Descriptions can
be extended later; no structures, hazards, regions or extra enemy types exist yet.

`RunState.seed` is a fresh unsigned 32-bit seed for each run. An explicit seed can
be passed to `createRunState` for repeatable tests. Generation is independent of
travel order. Flat scenery still uses the existing 160-pixel lattice, and bread
starts at x=1069 with 640-pixel spacing. The current flat layout deliberately
stays the same across seeds; bread's unused speed metadata uses a seeded roll
within the existing range. Difficulty/health formulas are unchanged and evaluated
only on first preparation, then retained when returning later.

`config/world.ts` controls:

- `sectionLength`: 2560 world pixels, currently sixteen scenery intervals.
- `preparationViewports`: 1 beyond each camera edge, before anything enters view.
- `cleanupViewports`: 3 beyond each edge, providing retention to avoid churn.

`WorldSystem` creates nearby scenery/ground sections and destroys distant objects.
Ground sections meet at exact world boundaries. Terrain is reproduced from data
when revisited; it requires no run-long Phaser-object list or saved terrain map.

`EnemySystem` prepares nearby slots from the same section generator. Off-screen
render/contact culling remains in place. Distant sprites are destroyed while
lightweight records retain health, speed and defeated status. Revisited survivors
get a new sprite with their previous stats; defeated slots never get another
sprite or award another kill. Large range upgrades enlarge the preparation and
retention buffers so streaming does not remove valid combat targets.

`XpSystem` unloads distant drops into section-indexed records containing their last
world position and value. Returning restores them once. Attraction movement is
preserved, including across section boundaries. Collection removes the drop; it
cannot be regenerated because its defeated enemy remains defeated. Magnet range
also contributes to the XP activation window. Current run XP/levels remain in
RunState as before. No XP formulas or upgrade effects changed.

Game coordinates remain world coordinates. `Game.ts` only coordinates movement,
camera/section preparation, combat, enemy contact, XP and overlays. Upcoming
enemies are prepared before combat; existing damage/XP ordering is preserved.
Pause stops generation along with gameplay. Scene shutdown clears objects and
all run-only records. Restarts retain the chosen character and start a fresh run.
HUD, Rosie, touch controls, upgrade selection and responsive FIT scaling remain
screen-fixed. The temporary speed/coordinate overlay is still available.

## Growth and validation

Live objects and active work depend on the nearby window, not travel history.
Persistent data must grow with encountered enemies and uncollected drops to allow
unlimited backtracking; it consists of small records, not hidden Phaser objects.
This version does not save those records to disk or restore them between runs.

Checks run: TypeScript, the complete reliability suite and production build.
Focused regressions cover deterministic descriptors, contiguous terrain, travel
past the old endpoint for both heroes, smooth camera extension, off-screen bread
preparation in both directions, wound/death persistence, XP streaming and
collection, large magnet/range upgrades, reset and forward-only distance.

The Node stress check traverses 1,000 sections (2.56 million world units), leaves a
drop in each and peaks at 113 live objects including children. In isolated Chrome,
fast-travel snapshots at sections 100, 500 and 1,000 all held 77 top-level display
objects, three terrain sections, eight live bread and three live XP drops. At the
last snapshot there were 4,002 enemy records and 998 dormant XP sections; after
forced GC Chrome reported about 7.2 MB used JS heap for the entire test page.
This is not a claim of constant total memory: persistence data grows with travel.

A rendered 6.5-second walk with Candy crossed x=16,000 and reached x≈17,775 in both
1024×768 desktop and 844×390 mobile landscape emulation. World speed measured
349.4–349.6 units/s, simulation/real time about 1.00x; average/max frame time was
33.3/33.5 ms and maximum per-frame camera movement about 13.4 world pixels, without
resets. Both had 74 top-level objects, three sections and eight live enemies.
Enemy contact was disabled only in this browser measurement to isolate traversal;
normal contact/combat is covered by unchanged regression checks. Mobile emulation
checks layout and timing, not real phone GPU/touch performance.

## Manual browser checks

1. With each character, travel past 500 m (the old world endpoint), then continue
   through several sections. Look for seams, missing ground, pop-in, camera jumps,
   speed changes or input delays.
2. Wound bread without killing it; defeat another and leave some XP uncollected.
   Travel several sections away, return and check wounds, deaths and drops.
3. Collect the remaining XP, leave and return again: neither bread nor collected
   XP should reappear. Distance should only increase beyond your previous maximum.
4. Test sword and Candy shots in both directions, range/magnet upgrades, level-up
   clicks/taps, pause/resume and repeated restarts after long travel.
5. On a phone in landscape, move/jump/attack simultaneously across section edges;
   rotate and switch apps, then resume. Check smoothness and fixed HUD/controls.

Stop here for manual confirmation. No structures, castles, chests, hazards, pets,
new enemies or new AI are included.

## Stable identity and round-trip safety

Each section has a stable `id` formed from the run seed and section index. Loaded
terrain retains its plain section descriptor; unloading destroys presentation
objects without changing the deterministic descriptor or saved occupant state.
There is only one loaded terrain entry per section index.

Bread placements are typed data (`kind`, `id`, `x`), rather than bare coordinates.
Enemy records use the placement ID, independently of the live sprite's current
position. Repeated creation returns the existing live enemy; defeated placements
cannot be recreated or killed a second time. XP uses a run-local increasing ID
retained through live/dormant transitions. Two legitimate drops at the same
position retain different IDs; collection removes that specific drop permanently.

Future layouts can supply different descriptor data while retaining section and
local-content IDs. New enemy kinds can extend the placement type and creation
handler. Structures, chests and castle encounters can later add their own typed
placements and ID-keyed run state using the same separation of deterministic data,
mutable records and disposable visuals. No unused content fields, generic content
registry or implementations of those features have been added.

The round-trip regression travels forward across 12 sections, backtracks to the
start, then travels forward again. Every step repeats preparation three times and
checks stable descriptors, terrain uniqueness (including orphan objects), enemy
IDs and wounds/deaths, live/dormant XP ID uniqueness, collected-drop absence and
unchanged saved enemy state. It also preserves two distinct drops at identical
coordinates. The round trip peaks at 111 live objects; the 1,000-section stress
check still peaks at 113. All persistent state resets on scene shutdown.
