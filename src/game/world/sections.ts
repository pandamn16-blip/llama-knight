import { WORLD } from '../config/world';
import { BALANCE } from '../config/balance';
import { STRUCTURES } from '../config/structures';
import { generatePlatforms } from './terrain';
import type { TerrainPlatform } from './terrain';

// Plain section data: generating the same index/seed never depends on travel order.
export interface WorldSection {
    id: string;
    index: number;
    startX: number;
    endX: number;
    seed: number;
    sceneryXs: number[];
    enemies: BreadPlacement[];
    structures: StructurePlacement[];
    platforms: TerrainPlatform[];
}

// Content identity is separate from position, so later layouts may place different
// occupants at the same X without sharing their saved state.
export interface CratePlacement { id: string; kind: 'crate'; x: number; healthDrop: boolean }
export type ChestReward = 'xp' | 'heal' | 'upgrade';
export interface ChestPlacement { id: string; kind: 'chest'; x: number; reward: ChestReward; elevation?: number }
export type StructurePlacement = CratePlacement | ChestPlacement;

export interface BreadPlacement { id: string; kind: 'bread'; x: number }

export function breadPlacementId(runSeed: number, x: number): string {
    const section = Math.floor(x / WORLD.sectionLength);
    return `${runSeed >>> 0}:${section}:bread:${x - section * WORLD.sectionLength}`;
}

export function sectionSeed(runSeed: number, index: number): number {
    let value = (runSeed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
    value = Math.imul(value ^ (value >>> 16), 0x85ebca6b) >>> 0;
    return (value ^ (value >>> 13)) >>> 0;
}

export function generateSection(index: number, runSeed: number): WorldSection {
    const startX = index * WORLD.sectionLength;
    const endX = startX + WORLD.sectionLength;
    const sceneryXs: number[] = [];
    const enemies: BreadPlacement[] = [];
    for (let x = Math.ceil(startX / BALANCE.scenery.spacing) * BALANCE.scenery.spacing;
        x < endX; x += BALANCE.scenery.spacing) sceneryXs.push(x);
    // Preserve the existing bread density and initial encounter position.
    const first = Math.max(0, Math.ceil((startX - WORLD.enemyStartX) / WORLD.enemySpacing));
    for (let x = WORLD.enemyStartX + first * WORLD.enemySpacing; x < endX; x += WORLD.enemySpacing) {
        enemies.push({ id: breadPlacementId(runSeed, x), kind: 'bread', x });
    }
    const structures: StructurePlacement[] = STRUCTURES.crate.offsets.map((offset, slot) => ({
        id: `${runSeed >>> 0}:${index}:crate:${slot}`, kind: 'crate',
        x: startX + offset + (index === 0 && slot === 0 ? 0 :
            sectionSeed(runSeed ^ 0x43524154, index * 2 + slot) % (2 * STRUCTURES.crate.jitter + 1) - STRUCTURES.crate.jitter),
        healthDrop: sectionSeed(runSeed ^ 0x4845414c, index * 2 + slot) / 0x100000000 < STRUCTURES.crate.healthDropChance
    }));
    if (index === 0 || index % STRUCTURES.chest.everySections === 0) {
        const rewards: ChestReward[] = ['xp', 'heal', 'upgrade'];
        const roll = sectionSeed(runSeed ^ 0x43484553, index);
        structures.push({ id: `${runSeed >>> 0}:${index}:chest:0`, kind: 'chest',
            x: index === 0 ? STRUCTURES.chest.firstX : startX + STRUCTURES.chest.offset +
                roll % (2 * STRUCTURES.chest.jitter + 1) - STRUCTURES.chest.jitter,
            reward: index === 0 ? 'upgrade' : rewards[sectionSeed(runSeed ^ 0x52455744, index) % rewards.length]
        });
    }
    const platforms = generatePlatforms(index, runSeed, sectionSeed(runSeed ^ 0x54455252, index));
    if (index > 0 && index % 2 === 1) {
        const perch = platforms[1];
        structures.push({ id: `${runSeed >>> 0}:${index}:chest:high`, kind: 'chest',
            x: perch.x, elevation: perch.height, reward: index % 4 === 1 ? 'xp' : 'upgrade' });
    }
    return { id: `${runSeed >>> 0}:${index}`, index, startX, endX,
        seed: sectionSeed(runSeed, index), sceneryXs, enemies, structures,
        platforms };
}

export function sectionWindow(scrollX: number, width: number, viewports: number): { first: number; last: number } {
    return {
        first: Math.max(0, Math.floor((scrollX - width * viewports) / WORLD.sectionLength)),
        last: Math.floor((scrollX + width * (1 + viewports)) / WORLD.sectionLength)
    };
}
