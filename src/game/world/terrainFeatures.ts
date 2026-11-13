import { WORLD } from '../config/world';
import type { TerrainPlatform, TerrainGap } from './terrain';

export type TerrainPiece = TerrainPlatform & { feature?: 'bridge' | 'crumble' };
export type BreakableWall = { id: string; x: number; width: number; height: number; hp: number };

// Bridge boards have independent collision and hit points. A small overlap
// between adjacent boards avoids invisible seams in one-way standing checks.
export function terrainPieces(platforms: readonly TerrainPlatform[], section: number): TerrainPiece[] {
    const pieces: TerrainPiece[] = [];
    for (let slot = 0; slot < platforms.length; slot++) {
        const p = platforms[slot];
        if (p.material === 'bridge') {
            const count = Math.ceil(p.width / WORLD.terrainTileSize);
            const segmentWidth = p.width / count;
            for (let i = 0; i < count; i++) pieces.push({
                ...p, id: `${p.id}:board:${i}`,
                x: p.x - p.width / 2 + segmentWidth * (i + 0.5),
                width: segmentWidth + 6, feature: 'bridge'
            });
        } else {
            // Don't crumble the permanent perches used by Pyromancers / chests
            // (slots 1 and 3) or the player's first few learning sections.
            const crumbleSlot = section % 2 === 0 ? 2 : 4;
            pieces.push(section >= 4 && slot === crumbleSlot ? {
                ...p, feature: 'crumble'
            } : { ...p });
        }
    }
    return pieces;
}

// Walls are optional ground-route blockers, never spawned in the tutorial,
// over pits, or on top of encounters, chests or the Phase 1 traps.
export function generateBreakableWalls(index: number, seed: number, gaps: readonly TerrainGap[],
    occupied: readonly number[]): BreakableWall[] {
    if (index < 4 || index % 2 !== 0) return [];
    const start = index * WORLD.sectionLength;
    for (const offset of [1110, 1910, 690, 2210, 1510]) {
        const x = start + offset + ((seed >>> (index % 12)) & 3) * 8;
        if (gaps.some(g => x >= g.start - 92 && x <= g.end + 92)) continue;
        if (occupied.some(other => Math.abs(x - other) < 135)) continue;
        return [{ id: `${seed >>> 0}:${index}:wall:0`, x, width: 42, height: 92, hp: 3 }];
    }
    return [];
}
