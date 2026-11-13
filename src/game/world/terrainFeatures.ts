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

// Swept segment against a solid rectangle; returned t is the first contact.
// Shared by fireballs and player projectiles to prevent tunnelling through walls.
export function segmentWallImpact(x0: number, y0: number, x1: number, y1: number,
    wall: BreakableWall, groundY: number): number | undefined {
    const dx = x1 - x0, dy = y1 - y0;
    let enter = 0, leave = 1;
    for (const [pos, delta, min, max] of [
        [x0, dx, wall.x - wall.width / 2, wall.x + wall.width / 2],
        [y0, dy, groundY - wall.height, groundY]
    ]) {
        if (Math.abs(delta) < 1e-9) {
            if (pos < min || pos > max) return undefined;
        } else {
            const a = (min - pos) / delta, b = (max - pos) / delta;
            enter = Math.max(enter, Math.min(a, b));
            leave = Math.min(leave, Math.max(a, b));
            if (enter > leave) return undefined;
        }
    }
    return enter;
}
