import { WORLD } from '../config/world';
import type { TerrainGap, TerrainPlatform } from './terrain';

export type HazardKind = 'snap-trap' | 'fixed-spikes' | 'timed-spikes';
export type HazardPlacement = { id: string; kind: HazardKind; x: number };

// Pure deterministic placement: hazards never block the start, sit over pits,
// or occupy reward/enemy/structure positions. The first encounter is a harmless
// visible spike patch; traps arrive only after the player learns combat.
export function generateHazards(index: number, seed: number, roll: number,
    gaps: readonly TerrainGap[], platforms: readonly TerrainPlatform[],
    occupied: readonly number[]): HazardPlacement[] {
    if (index === 0) return [];
    const cycle: HazardKind[] = index === 1 ? ['fixed-spikes'] :
        index === 2 ? ['timed-spikes'] : index === 3 ? ['snap-trap'] :
        ['snap-trap', 'fixed-spikes', 'timed-spikes'];
    const count = index < 4 ? 1 : (index < 9 ? 1 : 1 + (roll & 1));
    const positions = [420, 950, 1490, 2070, 670, 1210, 1760, 2310];
    const result: HazardPlacement[] = [];
    for (let slot = 0; slot < count; slot++) {
        const kind = cycle[(index + slot + ((roll >>> 4) % cycle.length)) % cycle.length];
        for (let candidate = 0; candidate < positions.length; candidate++) {
            const at = (candidate + slot * 3 + ((roll >>> 8) % positions.length)) % positions.length;
            const x = index * WORLD.sectionLength + positions[at];
            if (gaps.some(gap => x >= gap.start - 90 && x <= gap.end + 90)) continue;
            if (occupied.some(other => Math.abs(x - other) < 130)) continue;
            if (result.some(other => Math.abs(x - other.x) < 220)) continue;
            // Keep exposed traps off the floor underneath elevated ledges.
            if (platforms.some(p => Math.abs(x - p.x) < p.width / 2 + 28)) continue;
            result.push({ id: `${seed >>> 0}:${index}:hazard:${slot}`, x, kind });
            break;
        }
    }
    return result;
}
