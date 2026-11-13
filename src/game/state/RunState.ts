import { BALANCE } from '../config/balance';
import { CHARACTERS } from '../characters/definitions';
import type { CharacterId } from '../characters/definitions';
import { createWeaponState } from '../weapons/definitions';
import type { WeaponState } from '../weapons/definitions';

export type RunPhase = 'playing' | 'choosingUpgrade' | 'paused' | 'gameOver';

export interface RunState {
    seed: number;
    characterId: CharacterId;
    weapon: WeaponState;
    shielding: boolean;
    velocityY: number;
    onGround: boolean;
    health: number;
    maxHealth: number;
    kills: number;
    distance: number;
    startX: number;
    furthestX: number;
    xp: number;
    level: number;
    magnetRadius: number;
    moveSpeed: number;
    lastDamage: number;
    spawnClock: number;
    runTime: number;
    phase: RunPhase;
}

// Return a new object on every start/restart; no upgraded values are reused.
export function createRunState(characterId: CharacterId = 'llamaCrunch', seed = Math.floor(Math.random() * 0x100000000)): RunState {
    const character = CHARACTERS[characterId];
    return {
        seed: seed >>> 0,
        characterId, weapon: createWeaponState(character.startingWeapon),
        shielding: false, velocityY: 0, onGround: true,
        health: character.health, maxHealth: character.health,
        kills: 0, distance: 0, xp: 0,
        startX: BALANCE.player.startX, furthestX: BALANCE.player.startX,
        level: BALANCE.initial.level,
        magnetRadius: BALANCE.initial.magnetRadius,
        moveSpeed: character.moveSpeed,
        lastDamage: BALANCE.initial.lastActionTime,
        spawnClock: 0, runTime: 0,
        phase: 'playing'
    };
}
