# Mobile presentation and controls

Work is in the inner GitHub Desktop repository. No artwork, balancing, movement
speed/acceleration, collision dimensions, XP formulas, upgrades, dialogue data,
world generation or deployment configuration changed.

## Layout

Desktop remains a 1024 × 768 logical game using Phaser FIT and the original
keyboard controls, four on-screen buttons and desktop HUD/menu typography.

Touch-first devices (`pointer: coarse` and `hover: none`) keep the same 768-unit
logical height. In landscape, logical width expands to match the usable parent
aspect ratio (minimum 1024). FIT scales both axes equally. For example, 844 × 390
CSS pixels gives a 1662 × 768 logical viewport instead of a 520 × 390 letterboxed
canvas. Characters, weapon effects, the ground, jumping and world speeds keep
their existing world-unit scale. Mobile sees more world horizontally; existing
camera-relative enemy/section preparation follows the wider camera.

CSS keeps dynamic viewport height (`100dvh`, with the existing `vh` fallback) and
safe-area padding. Safe-area gutters use the sky colour rather than black. The
parent clips canvas margins to prevent margin collapse. ResizeObserver refreshes
Phaser's parent bounds before changing logical width; simply refreshing its scale
left stale dimensions briefly after padding/browser-UI changes. Logical height
and ground Y do not change on resize. Camera width tracks the new game width;
framing remains 38%. Menus and controls reflow and held inputs clear on resize.
Portrait continues to show the rotate message and pause an active run.

## Joystick and action buttons

Mobile replaces only the left/right pair with a fixed horizontal joystick:

- One controlling pointer ID; another finger cannot steal it.
- Centre `(128, height - 126)`, radius 96 logical pixels, knob radius 40.
- Neutral dead zone ±18 logical pixels. Beyond it, direction is binary at the
  character's existing full speed. Knob travel is clamped to ±56.
- Dragging outside the base retains ownership; releasing/cancelling that pointer
  immediately clears movement and recentres the knob.
- Jump/Attack use independent pointer sets, with radius 70 and separated centres
  at `width - 264` / `width - 102`. Typical usable phone heights give targets about
  65–75 CSS pixels across, away from safe-area edges.
- Phaser 4 maps native touch cancellation to its pointer-up/out processing.
  Focus/visibility/orientation/resize/modal/restart cleanup clears held inputs.
  Scene shutdown removes the move/resize/orientation handlers.

## HUD and menus

The mobile HUD uses a high-contrast background and 32-pixel logical text instead
of 17, showing health, level, XP, distance, weapon and kills in three compact rows.
Keyboard instructions are omitted. The row below the stats remains free for
future weapon/buff/pet icons; no placeholder items or item systems were added.
Rosie's existing portrait/bubble is enlarged and remains at the top-right.

Mobile upgrade rows are 118 logical pixels high with larger titles/descriptions;
hero selection and game-over screens use larger fonts and tap areas. Modal redraws
on resize destroy old children so invisible click targets cannot accumulate.
Individual upgrade/result buttons explicitly use scroll factor zero, preserving
correct input after world travel.

The temporary debug overlay is off by default. Developers can set
`WORLD.debugOverlay = true` in `src/game/config/world.ts` while running the dev
server. Its creation is also gated by `import.meta.env.DEV`, so production builds
keep it disabled even if the development flag is enabled. No runtime player-facing
debug control was added.

## Fullscreen limits

The first mobile main-menu tap requests fullscreen for `#app` only when the
standard API is available and enabled. Failure is caught and gameplay continues.
The whole app, including the rotate overlay and safe-area padding, is the target.
Desktop makes no fullscreen request. Browser controls cannot be forcibly hidden
when fullscreen is unsupported or denied; the game then fills the usable dynamic
browser viewport. In particular, iPhone Safari has limitations on fullscreen for
arbitrary elements, so a real-phone check remains necessary.

References: [MDN fullscreen availability and user-activation requirements](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen),
[WebKit's iPhone fullscreen support issue](https://bugs.webkit.org/show_bug.cgi?id=328773),
[dynamic viewport units](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length).

## Validation

TypeScript, the complete reliability suite and production build pass. Added
regressions cover viewport aspect ratio and parent-bound refresh order, joystick
ownership/dead zone, simultaneous actions, per-finger release/cancel handling,
focus/rotation/resize/modal resets, ten scene cycles, high-contrast mobile HUD,
modal reflow/cleanup and unavailable/denied fullscreen fallback.

Isolated Chrome emulation checks passed at landscape CSS sizes 844×390, 852×393,
932×430, 915×412 and 740×360. Canvas filled each viewport within rounding error,
with equal X/Y scale. A simulated 47-pixel left/right inset and 21-pixel bottom
inset produced an exactly fitting 750×369 usable area at 844×390. This tests safe
layout arithmetic, not a physical notch or Safari's rendering engine.

Actual browser touch events verified joystick+Jump+Attack, releasing Jump without
releasing the others, cancellation, and tapping upgrades after viewport reflow.
Joystick travel measured 280 world units/s for Crunch; camera framing measured
38.03%. Browser blur/visibility events paused and cleared input, and the mobile restart
button worked after camera travel to x=5000. Portrait paused and cleared inputs; returning resumed correctly. Ten
Candy restarts held listener counts constant, with one pointer-move handler and
four starting health each time. At 1440×900 desktop, the canvas remained centred
at 1200×900 CSS pixels with 1024×768 logical coordinates, 17-pixel HUD text and
the original controls. Physical iPhone Safari/Android testing is still manual.

## Phone checklist

1. Open landscape in Safari/Chrome, with browser bars visible and hidden. Check
   canvas fill, notch/home-indicator clearance, readable HUD and normal sprite
   proportions. Native fullscreen may be unavailable on iPhone.
2. Hold the joystick, Jump and Attack together. Release each separately, drag
   through the dead zone, reverse direction and drag outside the base. Movement
   should stop on release, with no speed ramp or stuck action.
3. Walk/backtrack across sections and fight with both heroes. Check framing,
   enemy entry, sword direction/range, Candy shots, XP and upgrades.
4. Rotate in play and during upgrade selection; change apps/tabs, return and
   resize browser chrome. Check paused state, neutral input and correctly aligned
   tappable choices after resuming.
5. Die/restart repeatedly; test hero selection and game-over buttons. Verify
   desktop keyboard controls and desktop layout separately.

Changed files: `index.html`, `public/style.css`, `src/game/main.ts`, `src/game/ui/layout.ts`,
`src/game/config/world.ts`, `src/game/input/PlayerInput.ts`, `src/game/scenes/Game.ts`,
`src/game/scenes/MainMenu.ts`, `src/game/scenes/Preloader.ts`,
`src/game/scenes/CharacterSelect.ts`, `src/game/ui/Hud.ts`,
`src/game/ui/UpgradePanel.ts`, `src/game/ui/GameOverPanel.ts`,
`src/game/world/Rosie.ts`, `tests/reliability.cjs` and this guide.
