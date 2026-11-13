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

export function loadPyromancerIdle(scene: Scene): void {
    scene.load.spritesheet(PYROMANCER_IDLE.key, PYROMANCER_IDLE.path,
        { frameWidth: 256, frameHeight: 256, startFrame: 0, endFrame: 5 });
}

export function registerPyromancerIdle(scene: Scene): void {
    const spec = PYROMANCER_IDLE;
    if (scene.anims.exists(spec.animationKey) || !hasSpriteFrames(scene, spec, spec)) return;
    scene.anims.create({
        key: spec.animationKey,
        frames: scene.anims.generateFrameNumbers(spec.key, { start: spec.start, end: spec.end }),
        frameRate: spec.fps, repeat: spec.repeat
    });
}

export function hasPyromancerIdle(scene: Scene): boolean {
    return hasSpriteFrames(scene, PYROMANCER_IDLE, PYROMANCER_IDLE) &&
        scene.anims.exists(PYROMANCER_IDLE.animationKey);
}
