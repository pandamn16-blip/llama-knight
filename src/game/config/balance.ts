// Distances are game pixels, speeds are pixels/second, and cooldowns are milliseconds.
export const BALANCE = {
    initial: {
        level: 1, magnetRadius: 75,
        lastActionTime: -1000
    },
    player: {
        groundHeightRatio: 0.78, groundOffset: 40,
        startX: 170, startXRatio: 0.17,
        minX: 45,
        jumpVelocity: -650, gravity: 1600,
        damageCooldown: 950, contactWidth: 43, contactHeight: 52
    },
    simulation: { maxDeltaSeconds: 0.05 },
    scenery: { spacing: 160 },
    enemy: {
        spawnOffsetX: 45, groundOffset: 32,
        despawnX: -80
    },
    xp: {
        initialThreshold: 3, thresholdPerLevel: 3, gemValue: 1,
        attractionSpeed: 360, minAttractionDistance: 0.1,
        pickupRadius: 30, despawnX: -50
    },
    upgrades: {
        choiceCount: 3, damage: 1, cooldownMultiplier: 0.85,
        minCooldown: 120, range: 20, maxHealth: 1, healing: 2,
        magnetRadius: 45, moveSpeedMultiplier: 1.12
    },
    effects: {
        slashDuration: 170, enemyHitDuration: 100,
        shakeDuration: 120, shakeIntensity: 0.004,
        damageFlashDuration: 90, damageFlashRepeats: 5
    }
} as const;
