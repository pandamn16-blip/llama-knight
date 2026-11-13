// New environmental rewards only; existing character/weapon/enemy balance is unchanged.
export const STRUCTURES = {
    crate: {
        health: 3, size: 58, offsets: [620, 1880], jitter: 80,
        xp: 1, healthDropChance: 0.2, hitFlashMs: 100, destructionMs: 180
    },
    chest: {
        firstX: 900, everySections: 3, offset: 1220, jitter: 120,
        range: 110, xp: 3, healing: 2, noticeMs: 2200
    },
    healthPickup: { amount: 1, radius: 32 }
} as const;
