import type { Scene } from 'phaser';
import { FOOT_ORIGIN, hasSpriteFrames } from '../rendering/spriteAssets';

// Six transparent 256x256 frames per strip. Character sheets share the same
// grounded anchor and scale; fireball frames are independent visual effects.
const character = {
    width: 1536,
    height: 256,
    frameWidth: 256 as const,
    frameHeight: 256 as const,
    start: 0,
    end: 5,
    originX: FOOT_ORIGIN.x,
    originY: FOOT_ORIGIN.y,
    scale: 0.5
} as const;

export const PYROMANCER_IDLE = {
    ...character, key: 'pyromancer:idle', animationKey: 'pyromancer:idle',
    path: 'enemies/pyromancer-pancake/idle.png', fps: 6, repeat: -1
} as const;
export const PYROMANCER_RUN = {
    ...character, key: 'pyromancer:run', animationKey: 'pyromancer:run',
    path: 'enemies/pyromancer-pancake/run.png', fps: 9, repeat: -1
} as const;
export const PYROMANCER_ATTACK = {
    ...character, key: 'pyromancer:attack', animationKey: 'pyromancer:attack',
    path: 'enemies/pyromancer-pancake/attack.png', fps: 9, repeat: 0,
    // The imported attack sheet was packed at ~130px character height, vs ~200px idle.
    // Scale just this state so the character stays the same apparent size.
    scale: 0.74
} as const;
export const PYROMANCER_BONK = {
    ...character, key: 'pyromancer:bonk', animationKey: 'pyromancer:bonk',
    path: 'enemies/pyromancer-pancake/bonk.png', fps: 11, repeat: 0,
    // Bonk poses were authored with a smaller character footprint than idle.
    scale: 0.74
} as const;
export const PYROMANCER_DEATH = {
    ...character, key: 'pyromancer:death', animationKey: 'pyromancer:death',
    path: 'enemies/pyromancer-pancake/death.png', fps: 9, repeat: 0
} as const;
export const PYROMANCER_FIREBALL = {
    ...character, key: 'pyromancer:fireball', animationKey: 'pyromancer:fireball',
    path: 'enemies/pyromancer-pancake/fireball.png', fps: 12, repeat: 0,
    end: 3, impactFrame: 5,
    // Frames 0–3 animate while airborne, then frame 3 holds; frame 5 is impact-only.
    scale: 0.27
} as const;

const sheets = [PYROMANCER_IDLE, PYROMANCER_RUN, PYROMANCER_ATTACK,
    PYROMANCER_BONK, PYROMANCER_DEATH, PYROMANCER_FIREBALL] as const;

export function loadPyromancerIdle(scene: Scene): void {
    for (const sheet of sheets) {
        scene.load.spritesheet(sheet.key, sheet.path,
            { frameWidth: 256, frameHeight: 256, startFrame: sheet.start, endFrame: 5 });
    }
}

export function registerPyromancerIdle(scene: Scene): void {
    for (const sheet of sheets) {
        if (scene.anims.exists(sheet.animationKey) || !hasSpriteFrames(scene, sheet, sheet)) continue;
        scene.anims.create({
            key: sheet.animationKey,
            frames: scene.anims.generateFrameNumbers(sheet.key, { start: sheet.start, end: sheet.end }),
            frameRate: sheet.fps, repeat: sheet.repeat
        });
    }
}

export function hasPyromancerSheet(scene: Scene, sheet: typeof sheets[number]): boolean {
    return hasSpriteFrames(scene, sheet, sheet) && scene.anims.exists(sheet.animationKey);
}

export function hasPyromancerIdle(scene: Scene): boolean { return hasPyromancerSheet(scene, PYROMANCER_IDLE); }
export function hasPyromancerRun(scene: Scene): boolean { return hasPyromancerSheet(scene, PYROMANCER_RUN); }
export function hasPyromancerAttack(scene: Scene): boolean { return hasPyromancerSheet(scene, PYROMANCER_ATTACK); }
export function hasPyromancerBonk(scene: Scene): boolean { return hasPyromancerSheet(scene, PYROMANCER_BONK); }
export function hasPyromancerDeath(scene: Scene): boolean { return hasPyromancerSheet(scene, PYROMANCER_DEATH); }
export function hasPyromancerFireball(scene: Scene): boolean { return hasPyromancerSheet(scene, PYROMANCER_FIREBALL); }
