# Llama Crunch sprite integration

## Active sources

All paths are relative to `public/assets/characters/llama-crunch/`.

| State | File | Frames | FPS | Playback |
| --- | --- | --- | --- | --- |
| Idle | `idle.png` | 0–3 | 6 | Loop |
| Run | `run.png` | 0–5 | 10 | Loop |
| Attack pose (fallback) | `attack.png` | 0–4 | 30 | Once |
| Jump | `llama-crunch-9x3-256-import-test.png` | 10–12 | 12 | Once, hold |
| Fall | `llama-crunch-9x3-256-import-test.png` | 13–14 | 10 | Once, hold |
| Hurt | `llama-crunch-9x3-256-import-test.png` | 19–21 | 18 | Once |
| Death | `llama-crunch-9x3-256-import-test.png` | 22–26 | 10 | Once, hold |

Verified: `idle.png` is 1024 × 256 (4 cells), `run.png` is 1536 × 256
(6 cells), and `attack.png` is 1280 × 256 (5 cells). All are 8-bit RGBA with
real alpha transparency. The combined source remains 2304 × 768 (27 cells).
No PNG has been resized, cropped or edited by the integration.

The existing Preloader uses `assets/` as its base path and calls the shared sheet
loader/animation registrar. It queues these four unique textures, including the
combined sheet for fallback. Separate clips are preferred per state. If an
individual strip fails validation or cannot load, its original combined clip is
used instead (idle 0–3, run 4–9, attack 15–18 at 24 FPS). If required states have
neither valid source, the character retains the placeholder. Candy is unchanged.

## Dedicated sword effect

The active melee effect is
`public/assets/weapons/sword-slash/effect.png`: a verified 1280 × 256 transparent
RGBA PNG with five 256 × 256 frames. Preloader loads it and registers frames 0–4
at **18 FPS**, repeat 0. Each accepted melee attack spawns one animated effect.
The asset was found under the mistaken filename
`public/assets/characters/llama-crunch/public:assets:weapons:sword-slash:effect.png`
and copied byte-for-byte to the intended path. The original is preserved.

The effect is centred at `(player.x + direction * meleeRange / 2, player.y)`,
with origin (0.5, 0.5), uniform scale `meleeRange / 256`, and horizontal flip for
left attacks. Its canvas spans from the player anchor to the current range in
that direction. Art padding remains transparent; there is no stretching or
change to attack range calculations. Range upgrades affect subsequent effects.
The effect stays at its attack position and facing, like the previous drawing.

The character's five-frame `attack.png` and the external five-frame slash both
start on the same accepted attack. Their trails intentionally overlap. The effect
renders at depth 7, in front of the character at depth 6. Both retain their existing
playback rates and left-facing mirroring. After the character attack finishes, its
current idle/run/jump/fall pose resumes. Neither image is cropped or changed.

If the effect fails validation/loading, the baked character attack pose is used.
Its five frames at 30 FPS preserve the previous roughly 167 ms pose duration.
When that pose is unavailable or blocked by hurt, the generated slash remains
as a final visual fallback. Animation and effect choices never gate damage,
directional hit detection, reach or cooldowns.

The external effect pauses for upgrades and interruptions. Its completion handler
destroys it and removes the reference; death and scene shutdown remove any
unfinished effects. Multiple legitimate swings can each have their own effect
when attack-speed upgrades shorten the interval. Candy remains unchanged.

## Rendering settings

Configuration: `src/game/characters/spriteAnimations.ts`.

- Scale: 0.5.
- Origin: (0.5, 0.875), matching foot/root pixel (128, 224).
- Child offsets: (0, 40).
- Gameplay anchor, collision calculations and character stats: unchanged.

The renderer chooses idle/run from horizontal movement, jump/fall from vertical
movement, and accepted combat events trigger attack/hurt. Death remains visual
only beneath the existing results panel. Horizontal flipping, pause/resume,
character selection, restart and Candy's placeholder behaviour are retained.

## Artwork review

New strips have the required cell geometry and transparent backgrounds. The
attack artwork includes a blade, blue trail and shadows. A small detached blue
streak is visible near the start of the final attack cell; review it in motion.
The legacy combined sheet still has documented pose drift and cell-edge artifacts
in jump/fall/hurt/death. Mixing exports may reveal style/scale differences between
poses; global scale/origin/offset settings are intentionally unchanged.

Future artwork must follow [the visual asset standard](visual-asset-standard.md).
Do not fix artwork alignment by changing gameplay anchors or hitboxes.

## Validation

Run `node tests/reliability.cjs`, `npx tsc --noEmit` and `npm run build-nolog`.
Tests validate the actual PNG geometry/alpha, mixed-source registration, per-state
fallback, animation transitions, flipping, duplicate effect suppression and
unchanged damage/cooldowns/XP/upgrades. Phaser objects are simulated in these
regression tests; actual animation appearance requires browser verification.

Refresh the browser and test idle/run/attack plus transitions to the combined
jump/fall/hurt/death clips. Check left/right attacks, a single slash trail per attack, range upgrades, pauses,
rotation, repeated restarts and Candy. Block `run.png` or `attack.png` in DevTools
and reload to verify the corresponding combined fallback; unblock afterwards.
