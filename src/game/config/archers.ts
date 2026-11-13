// Bread Archers guard optional upper routes, with a visible aiming tell.
export const ARCHER = {
    hp: 4, damage: 1, footOffset: 32,
    detectionRange: 450, detectionHeight: 240,
    aimDuration: 0.7, reloadDuration: 2.5,
    projectileSpeed: 285, projectileRange: 700,
    arrowHitRadius: 25, activationMargin: 175
} as const;
