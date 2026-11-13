import { WORLD } from '../config/world';

export interface TerrainPlatform {
    id: string;
    x: number; // centre in world coordinates
    width: number;
    height: number; // top surface above the continuous main ground
}

// A small, entirely optional selection of reachable ledges. Every section retains
// a continuous ground route; these layouts do not require precision platforming.
export function generatePlatforms(index: number, seed: number, roll: number): TerrainPlatform[] {
    const start = index * WORLD.sectionLength;
    const layout = roll % 3;
    // Two short, connected upper routes per section. A running jump reaches
    // the next ledge; the ground underneath remains entirely continuous.
    const routes = layout === 0 ? [520, 824, 1500, 1804] :
        layout === 1 ? [640, 944, 1620, 1924] : [440, 744, 1432, 1736];
    return routes.map((offset, i) => ({
        id: `${seed >>> 0}:${index}:platform:${i}`,
        x: start + offset,
        width: 4 * WORLD.terrainTileSize,
        height: i % 2 === 0 ? 64 : 112
    }));
}

export function platformTop(groundY: number, platform: TerrainPlatform): number {
    return groundY - platform.height;
}

function covers(platform: TerrainPlatform, playerX: number): boolean {
    // Slight inset keeps standing on an edge intentional rather than jittery.
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
