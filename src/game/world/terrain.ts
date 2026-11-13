import { WORLD } from '../config/world';

export interface TerrainPlatform {
    id: string;
    x: number;
    width: number;
    height: number; // Top surface above the continuous ground.
}

// Composed motifs, not a repeating four-platform stamp. Every motif has two
// short, reachable routes, with optional stepping stones between them.
// No pits or mandatory jumps. Collision is independent of any artwork.
const MOTIFS = [
    [440, 744, 1472, 1776],
    [608, 896, 1568, 1888],
    [400, 720, 1344, 1648],
    [544, 864, 1584, 1904],
    [480, 800, 1424, 1728],
    [672, 976, 1536, 1840]
] as const;

export function generatePlatforms(index: number, seed: number, roll: number): TerrainPlatform[] {
    const start = index * WORLD.sectionLength;
    const motif = MOTIFS[roll % MOTIFS.length];
    const variance = (roll >>> 8) & 0x7;
    const shift = (variance - 3) * 16;
    const widths = [256, 256, 256, 256];
    return motif.map((offset, i) => {
        // More variety in silhouette and timing, while avoiding precision jumps.
        const smallVariation = ((roll >>> (12 + i * 3)) & 0x3) * 16;
        const width = widths[i] + (((roll >>> (i * 2 + 3)) & 1) ? 64 : 0);
        const height = i % 2 === 0 ? 64 + (smallVariation > 16 ? 16 : 0)
            : 96 + (smallVariation > 16 ? 16 : 0);
        return {
            id: `${seed >>> 0}:${index}:platform:${i}`,
            x: start + offset + shift + (i % 2 === 0 ? 0 : smallVariation - 16),
            width, height
        };
    });
}

export function platformTop(groundY: number, platform: TerrainPlatform): number {
    return groundY - platform.height;
}

function covers(platform: TerrainPlatform, playerX: number): boolean {
    return Math.abs(playerX - platform.x) <= platform.width / 2 - 4;
}

export function landingSurfaceY(platforms: readonly TerrainPlatform[], groundY: number,
    playerX: number, previousFoot: number, nextFoot: number): number | undefined {
    if (nextFoot < previousFoot) return undefined;
    let hit: number | undefined;
    for (const platform of platforms) {
        const top = platformTop(groundY, platform);
        if (covers(platform, playerX) && previousFoot <= top + 1 && nextFoot >= top &&
            (hit === undefined || top < hit)) hit = top;
    }
    if (previousFoot <= groundY + 1 && nextFoot >= groundY && (hit === undefined || groundY < hit)) hit = groundY;
    return hit;
}

export function standingSurfaceY(platforms: readonly TerrainPlatform[], groundY: number,
    playerX: number, currentFoot: number): number | undefined {
    for (const platform of platforms) {
        const top = platformTop(groundY, platform);
        if (covers(platform, playerX) && Math.abs(currentFoot - top) < 2) return top;
    }
    return Math.abs(currentFoot - groundY) < 2 ? groundY : undefined;
}
