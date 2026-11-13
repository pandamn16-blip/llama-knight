import { WORLD } from '../config/world';
import { BALANCE } from '../config/balance';

// Plain section data: generating the same index/seed never depends on travel order.
export interface WorldSection {
    id: string;
    index: number;
    startX: number;
    endX: number;
    seed: number;
    sceneryXs: number[];
    enemies: BreadPlacement[];
}

// Content identity is separate from position, so later layouts may place different
// occupants at the same X without sharing their saved state.
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
    return { id: `${runSeed >>> 0}:${index}`, index, startX, endX,
        seed: sectionSeed(runSeed, index), sceneryXs, enemies };
}

export function sectionWindow(scrollX: number, width: number, viewports: number): { first: number; last: number } {
    return {
        first: Math.max(0, Math.floor((scrollX - width * viewports) / WORLD.sectionLength)),
        last: Math.floor((scrollX + width * (1 + viewports)) / WORLD.sectionLength)
    };
}
