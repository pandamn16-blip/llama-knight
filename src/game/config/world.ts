// Endless flat sections. These are spatial/presentation settings,
// independent of character stats, collision thresholds and combat balance.
export const WORLD = {
    sectionLength: 2560,
    preparationViewports: 1,
    cleanupViewports: 3,
    pixelsPerMetre: 32,
    rightFollowRatio: 0.38,
    cameraSharpness: 18,
    enemyStartX: 1069,
    enemySpacing: 640,
    maxCatchUpSeconds: 0.25,
    debugOverlay: false,
    rosieDialogueInterval: 12000,
    rosieLineDuration: 3500
} as const;
