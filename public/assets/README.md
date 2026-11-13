# Llama Knight assets

Paths below are relative to `public/assets/` (served as `assets/` in the game).
Use lowercase kebab-case folder/file names, descriptive asset names and real
artwork only. Character animation sheets should use transparent PNG or lossless
WebP with alpha; keep frame dimensions and animation mappings in code configuration.
Adding a folder does not load an asset or enable a gameplay feature.

Character and enemy animations must follow `docs/visual-asset-standard.md` in the
repository: untrimmed transparent 256 × 256 frames, facing right, grounded foot
anchor (128, 224), and no artwork crossing cell boundaries. Separate `idle.png`,
`run.png`, `jump.png`, `fall.png`, `attack.png`, `hurt.png` and `death.png` sheets
are preferred. Retain existing combined sheets until explicitly migrated.

| Folder | Intended assets |
| --- | --- |
| `characters/llama-crunch/`, `characters/candy/` | Character sprites and animation sheets |
| `enemies/bread/`, `enemies/lobster/`, `enemies/alien/` | Enemy artwork |
| `pets/pikachu/`, `pets/groot/`, `pets/globe/` | Equipped pet icons and ability artwork |
| `weapons/sword-slash/`, `weapons/candy-shot/`, `weapons/pickle-bomb/` | Weapon artwork |
| `npc/rosie/` | Rosie's artwork |
| `environments/backgrounds/`, `environments/ground/`, `environments/obstacles/` | Scenery artwork |
| `effects/` | Shared visual effects |
| `ui/portraits/`, `ui/icons/`, `ui/menus/`, `ui/dialogue/` | Interface artwork |

## Adding individual animations

Place animation sheets directly inside each of these folders; do not create an
extra animation subfolder:

- `characters/llama-crunch/`
- `characters/candy/`
- `enemies/bread/`
- `enemies/lobster/`
- `enemies/alien/`

Use exactly these filenames: `idle.png`, `run.png`, `jump.png`, `fall.png`,
`attack.png`, `hurt.png`, `death.png`. Add only finished artwork; missing states
should have no file, rather than an empty PNG.

Each file is a transparent spritesheet with untrimmed **256 × 256 pixel frames**.
Prefer one horizontal row: for N frames, export an image N × 256 pixels wide and
256 pixels high, with no spacing or outer margins. Frames run left to right.
Face right; keep the grounded foot anchor at pixel **(128, 224)** in every cell,
with all artwork contained inside its frame. Keep frame counts and FPS with the
asset handoff so they can be entered into the animation configuration.

Llama Crunch's next uploads go here:

```text
public/assets/characters/llama-crunch/idle.png
public/assets/characters/llama-crunch/run.png
public/assets/characters/llama-crunch/attack.png
```

Copy new sheets alongside the existing combined sheet, never over it. Uploading
files alone does **not** switch the running game to those animations. A later,
separate integration step must configure the character's `format: 'separate'`,
per-state paths, frame counts and playback rates in
`src/game/characters/spriteAnimations.ts`. Keep the active combined sheet and
loader references intact until that migration is explicitly requested. Missing replacement states can retain their configured combined-sheet clips;
a state with neither a valid primary sheet nor a valid fallback retains the placeholder.

## Existing paths

Do not move existing assets merely to match these conventions. Existing `bg.png`
and `logo.png` remain at their current paths. Llama Crunch uses `idle.png`, `run.png` and `attack.png` in
`characters/llama-crunch/`. Its combined
`characters/llama-crunch/llama-crunch-9x3-256-import-test.png` remains active for
jump/fall/hurt/death and as a per-state fallback, configured in
`src/game/characters/spriteAnimations.ts`. The preloader's base path is `assets/`.
Do not rename or relocate a loaded asset without updating its configuration.
The placeholder remains available if the sheet cannot load or fails validation.

## Future equipped pets

Pikachu, Groot and Globe are equipped pets, not physical followers. Once acquired,
they appear as icons in the top-left HUD and activate their abilities automatically.
They do not move around the level and need no follower AI.

- Pikachu: offensive lightning abilities.
- Groot: defensive shielding, roots and healing.
- Globe: utility, XP attraction and gravity-related abilities.

Each pet will eventually have five upgrade levels. Pet acquisition and upgrades
will eventually be offered through the existing three-choice upgrade system.
Equipped pet runtime state belongs to the current run; unlocks belong to persistent
player progress. These are future design requirements, not implemented systems.

Folders intentionally contain no fake images or placeholder files. Git does not
track empty directories; recreate them from this folder list if needed in a fresh
checkout.
