import { BALANCE } from '../config/balance';

export type WeaponId = 'swordSlash' | 'candyShot';
type WeaponDefinition = {
    id: WeaponId;
    name: string;
    damage: number;
    cooldown: number;
    range: number;
} & ({ kind: 'melee'; arcHalfAngle: number } | { kind: 'projectile'; projectileSpeed: number; hitHalfWidth: number; hitHalfHeight: number });

export const WEAPONS: Record<WeaponId, WeaponDefinition> = {
    swordSlash: {
        id: 'swordSlash', name: 'Sword Slash', kind: 'melee',
        damage: 2, cooldown: 500, range: 115, arcHalfAngle: 60
    },
    candyShot: {
        id: 'candyShot', name: 'Candy Shot', kind: 'projectile',
        damage: 1, cooldown: 900, range: 650,
        projectileSpeed: 650, hitHalfWidth: 36, hitHalfHeight: 40
    }
};

// Mutable stats belong to this run, independently of the immutable definitions.
export interface WeaponState {
    id: WeaponId;
    damage: number;
    cooldown: number;
    range: number;
    lastAttack: number;
}

export function createWeaponState(id: WeaponId): WeaponState {
    const definition = WEAPONS[id];
    return { id, damage: definition.damage, cooldown: definition.cooldown,
        range: definition.range, lastAttack: BALANCE.initial.lastActionTime };
}
