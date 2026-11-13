// Pyromancer Pancakes guard optional elevated routes with telegraphed attacks.
export const ARCHER = {
    hp: 4, damage: 1, footOffset: 32,
    detectionRange: 900, detectionHeight: 240,
    aimDuration: 0.7, reloadDuration: 2.5,
    projectileSpeed: 285, projectileRange: 1400,
    arrowHitRadius: 25, activationMargin: 175,
    patrolSpeed: 36, chaseSpeed: 90, preferredRange: 300,
    ledgeInset: 35, contactRange: 85, contactHeight: 55, contactWindup: 0.55,
    // Combined centre separation for the Pyromancer body and playable character.
    // The previous 42px let the player visibly penetrate the wide pancake stack.
    contactWidth: 68,
    standHeight: 84, standHalfWidth: 47,
    fireContactDamage: 1,
    fireballScale: 0.27, fireballSpawnX: 60, fireballSpawnY: -38,
    deathDuration: 0.78
} as const;
