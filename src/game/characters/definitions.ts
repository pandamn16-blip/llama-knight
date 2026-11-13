import type { WeaponId } from '../weapons/definitions';

export type CharacterId = 'llamaCrunch' | 'candy';
export type CharacterVisual = 'llama' | 'candy';
export interface CharacterDefinition {
    id: CharacterId;
    name: string;
    description: string;
    health: number;
    moveSpeed: number;
    startingWeapon: WeaponId;
    visual: CharacterVisual;
    canShield?: boolean;
}

export const CHARACTERS: Record<CharacterId, CharacterDefinition> = {
    llamaCrunch: {
        id: 'llamaCrunch', name: 'Llama Crunch', description: 'Defensive and close-range.\nStand your ground and slash the bread.',
        health: 6, moveSpeed: 280, startingWeapon: 'swordSlash', visual: 'llama', canShield: true
    },
    candy: {
        id: 'candy', name: 'Candy', description: 'Fast and ranged.\nKeep moving and fire from a distance.',
        health: 4, moveSpeed: 350, startingWeapon: 'candyShot', visual: 'candy'
    }
};

export function isCharacterId(value: unknown): value is CharacterId {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CHARACTERS, value);
}
