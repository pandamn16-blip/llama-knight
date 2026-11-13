import { BALANCE } from '../config/balance';
import { WORLD } from '../config/world';

export const DIFFICULTY = { metresPerRegion: 250 } as const;

// Use run.furthestX for progression, or an occupant's original world X to assign
// its permanent region. Never use current player level, elapsed time or chase position.
export function difficultyRegion(worldX: number): number {
    const metres = Math.max(0, worldX - BALANCE.player.startX) / WORLD.pixelsPerMetre;
    return Math.floor(metres / DIFFICULTY.metresPerRegion);
}
