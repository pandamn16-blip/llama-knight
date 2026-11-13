# Character and enemy visual asset standard

This contract applies to all future playable-character and enemy animation art.
The shared TypeScript contract is `src/game/rendering/spriteAssets.ts`.

## Required artist export

| Property | Required value |
| --- | --- |
| Cell dimensions | Exactly **256 × 256 pixels**, including transparent space |
| File format | Transparent RGBA PNG, or lossless WebP with alpha |
| Direction | Face **right**, including attacks; do not mirror individual poses |
| Grounded foot/root pivot | **(128, 224)** measured from the top-left of every cell |
| Preferred layout | One sheet per animation, one horizontal row, chronological order |
| Sheet dimensions | `frameCount × 256` wide and `256` high for a single-row strip |
| Sheet margins / spacing | Zero; padding must be inside each untrimmed cell |
| Cell containment | Entire silhouette, equipment and trails stay inside that cell |

Do not trim frames, auto-crop poses, bake in a background, rescale individual
frames, or shift the root between poses. Preserve the grounded baseline at y=224
and root x=128 across all seven states. Airborne poses should retain the same
root convention: gameplay already moves the character upward/downward. Death
poses should stay grounded within the same canvas.

Leave at least a small transparent safety gutter (2 pixels recommended) inside
cell edges to prevent clipping and neighbouring-frame bleed. Transparent pixels
must have real alpha, not a painted checkerboard or black/white matte. Export
weapons/trails only when agreed with the game's separate combat-effects drawing;
artwork never defines attack reach or hit timing.

## Preferred folders and names

For example, under `public/assets/characters/llama-crunch/`:

```text
idle.png
run.png
jump.png
fall.png
attack.png
hurt.png
death.png
```

Use the same filenames under `characters/candy/` or `enemies/bread/`,
`enemies/lobster/`, `enemies/alien/`. `.webp` is also supported when its configured
path uses that extension. Counts and playback rates are declared in code; frames
in each separate sheet start at zero. Single-frame clips are acceptable where
there is no animated pose. No extra folders, fake sheets or enemy systems are
created merely to describe this convention.

A pack declares `format: 'separate'`, a stable animation-key prefix and seven
animation entries. Each entry has its own sheet key/path/dimensions and clip
`start`, `end`, `fps`, `repeat`. The player renderer switches texture as it switches
animation. Example entry:

```ts
idle: {
    sheet: {
        key: 'llama-crunch-sheet:idle',
        path: 'characters/llama-crunch/idle.png', // Relative to assets/.
        width: 1024, height: 256, frameWidth: 256, frameHeight: 256
    },
    start: 0, end: 3, fps: 6, repeat: -1
}
```

Idle/run normally loop (`repeat: -1`); jump/fall/attack/hurt/death play once
(`repeat: 0`). Jump/fall hold their final pose until movement state changes;
death holds its final pose. Animation timing does not gate damage or gameplay.

All seven states must resolve to valid frames before a character replaces its
placeholder. A separate state can declare a combined-sheet fallback with its own
frame range and playback rate. A valid primary takes priority; a missing or invalid
primary uses its valid fallback. If a required state has neither, use the placeholder. Do not configure paths for new art until those exports exist.

## Visual parameters versus gameplay

| Parameter | Meaning | Current Crunch value |
| --- | --- | --- |
| `scale` | Uniform scale of the child artwork only | `0.5` |
| `originX` | Fractional horizontal image pivot | `0.5` (`128/256`) |
| `originY` | Fractional vertical image pivot | `0.875` (`224/256`) |
| `offsetX` | Child's local horizontal offset in game pixels | `0` |
| `offsetY` | Child's local vertical offset in game pixels | `40` |

The parent container is the stable gameplay anchor. Only its child sprite gets
these visual transforms. The player's anchor is currently 40 game pixels above
ground, so offsetY=40 places the standard foot pivot on the ground. Future enemy
visuals should similarly use their existing gameplay anchor plus a visual offset;
the current Bread anchor is 32 pixels above ground. This is documentation, not a
change to enemy rendering or collisions.

For any transform, the exported foot pivot appears at:

```text
footWorldX = gameplayX + offsetX + (128 - 256 * originX) * scale
footWorldY = gameplayY + offsetY + (224 - 256 * originY) * scale
```

Scale/origin/offset changes never resize a hitbox or update collision thresholds.
Neither opaque-pixel bounds nor sprite display dimensions are used to calculate
movement boundaries, player contact, sword reach or projectile hits. Weapon damage,
cooldowns, range, jumping and gravity retain their separate gameplay configuration.
Do not scale/reposition the gameplay container to accommodate new art.

## Compatibility and validation limits

`format: 'combined'` retains existing multi-row sheets and frame mappings. Crunch
uses separate idle/run/attack strips and retains
`llama-crunch-9x3-256-import-test.png` unchanged for the other states and fallback. That import-test
art has known cell-edge/alignment defects; compatibility does not make it a
conforming reference asset. Candy and the current shape-based enemies are unchanged.
A future art migration must correct the exports, not compensate by moving hitboxes.

Runtime validation checks fixed cell size, whole-cell sheet dimensions, actual
texture dimensions, clip ranges, all required frames and all seven states.
TypeScript also restricts declared frame dimensions to 256. Existing asset tests
check the real Crunch PNG's alpha and dimensions. Automated geometry checks cannot
prove that a drawing faces right, uses the intended anatomical pivot, or belongs
entirely to one cell: those require artist review. Inspect each exported frame on
a checkerboard, onion-skin adjacent poses at (128,224), and check all cell edges.
Never mark artwork as conforming solely because its image dimensions pass.

Regression tests cover separate-texture loading/switching, combined compatibility,
invalid packs and visual transforms without changing gameplay anchors. Run
`node tests/reliability.cjs`, `npx tsc --noEmit` and `npm run build-nolog`.
