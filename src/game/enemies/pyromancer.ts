import type { Scene } from 'phaser';
import { FOOT_ORIGIN, hasSpriteFrames } from '../rendering/spriteAssets';

export const PYROMANCER_IDLE = {
    key: 'pyromancer:idle',
    animationKey: 'pyromancer:idle',
    path: 'enemies/pyromancer-pancake/idle.png',
    width: 1536,
    height: 256,
    frameWidth: 256 as const,
    frameHeight: 256 as const,
    start: 0,
    end: 5,
    fps: 6,
    repeat: -1,
    originX: FOOT_ORIGIN.x,
    originY: FOOT_ORIGIN.y,
    scale: 0.5
} as const;

// Run sheet uses the same 6 x 256px grounded frame contract as idle.
// Keeping one origin and scale prevents a visual hop when changing states.
export const PYROMANCER_RUN = {
    ...PYROMANCER_IDLE,
    key: 'pyromancer:run',
    animationKey: 'pyromancer:run',
    path: 'enemies/pyromancer-pancake/run.png',
    fps: 9
} as const;

const sheets = [PYROMANCER_IDLE, PYROMANCER_RUN] as const;

export function loadPyromancerIdle(scene: Scene): void {
    for (const sheet of sheets) {
        scene.load.spritesheet(sheet.key, sheet.path,
            { frameWidth: 256, frameHeight: 256, startFrame: sheet.start, endFrame: sheet.end });
    }
}

export function registerPyromancerIdle(scene: Scene): void {
    for (const sheet of sheets) {
        if (scene.anims.exists(sheet.animationKey) ||
            !hasSpriteFrames(scene, sheet, sheet)) continue;
        scene.anims.create({
            key: sheet.animationKey,
            frames: scene.anims.generateFrameNumbers(sheet.key, { start: sheet.start, end: sheet.end }),
            frameRate: sheet.fps, repeat: sheet.repeat
        });
    }
}

export function hasPyromancerIdle(scene: Scene): boolean {
    return hasSpriteFrames(scene, PYROMANCER_IDLE, PYROMANCER_IDLE) &&
        scene.anims.exists(PYROMANCER_IDLE.animationKey);
}

export function hasPyromancerRun(scene: Scene): boolean {
    return hasSpriteFrames(scene, PYROMANCER_RUN, PYROMANCER_RUN) &&
        scene.anims.exists(PYROMANCER_RUN.animationKey);
}
