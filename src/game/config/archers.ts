// Pyromancer Pancakes guard optional elevated routes with telegraphed attacks.
export const ARCHER = {
    hp: 4, damage: 1, footOffset: 32,
    detectionRange: 450, detectionHeight: 240,
    aimDuration: 0.7, reloadDuration: 2.5,
    projectileSpeed: 285, projectileRange: 700,
    arrowHitRadius: 25, activationMargin: 175,
    patrolSpeed: 36, chaseSpeed: 90, preferredRange: 150,
    ledgeInset: 35, contactRange: 55, contactHeight: 55, contactWindup: 0.55,
    contactWidth: 42,
    fireballScale: 0.27, fireballSpawnX: 60, fireballSpawnY: -38,
    deathDuration: 0.78
} as const;
