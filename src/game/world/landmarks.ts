import { WORLD } from '../config/world';

// World landmarks are scenery, not physical walls. The ground stays playable
// until actual obstacles receive a deliberately authored collision profile.
export type LandmarkKind = 'arch' | 'watchtower' | 'ruins' | 'fence' | 'boulders' | 'sign';
export interface Landmark {
    id: string;
    kind: LandmarkKind;
    x: number;
    scale: number;
    flip: boolean;
}

const KINDS: readonly LandmarkKind[] = ['arch', 'watchtower', 'ruins', 'fence', 'boulders', 'sign'];

export function generateLandmarks(index: number, seed: number, roll: number): Landmark[] {
    const start = index * WORLD.sectionLength;
    // 2–4 distinct landmarks per section; not an identical stamp.
    const count = 2 + (roll % 3);
    const landmarks: Landmark[] = [];
    for (let slot = 0; slot < count; slot++) {
        const bits = ((roll >>> (slot * 7)) ^ (roll >>> 17) ^ Math.imul(slot + 1, 0x45d9f3b)) >>> 0;
        const kind = KINDS[(bits >>> 3) % KINDS.length];
        const zoneStart = 180 + slot * (2180 / count);
        const offset = 70 + ((bits >>> 9) % 260);
        const x = start + Math.min(2390, Math.round(zoneStart + offset));
        // Avoid placing large landmarks on top of the starting hero.
        if (index === 0 && x < 400) continue;
        landmarks.push({
            id: `${seed >>> 0}:${index}:landmark:${slot}`,
            kind, x,
            scale: [0.85, 1, 1.15][(bits >>> 5) % 3],
            flip: !!(bits & 1)
        });
    }
    return landmarks;
}
