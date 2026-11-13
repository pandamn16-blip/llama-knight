import type { Scene } from 'phaser';
import { hasSpriteFrames } from '../rendering/spriteAssets';

export const BREAD = {
    initialHealth: 6, healthPerRegion: 1, maxHealthBonus: 4, damage: 1,
    idleMin: 0.8, idleMax: 1.8, patrolDistance: 48, patrolSpeed: 35,
    detectionRange: 260, detectionHeight: 160, chaseSpeed: 125,
    loseRange: 400, territoryLeash: 780, returnSpeed: 60,
    meleeStop: 60, attackRange: 82, attackHeight: 52,
    windup: 0.35, active: 0.1, recovery: 0.9, animationLead: 0.2,
    activationMargin: 160, deathDuration: 0.5,
    standHeight: 65, standHalfWidth: 34,
    scale: 0.36, originX: 0.5, originY: 0.875, offsetX: 0, offsetY: 32
} as const;

export const BREAD_ANIMATIONS = {
    idle: { fps: 5, repeat: -1 }, run: { fps: 8, repeat: -1 },
    attack: { fps: 10, repeat: 0 }, death: { fps: 8, repeat: 0 }
} as const;
export type BreadAnimation = keyof typeof BREAD_ANIMATIONS;
export const breadSheet = (state: BreadAnimation) => ({
    key: `bread:${state}`, path: `enemies/bread/${state}.png`, width: 1024, height: 256,
    frameWidth: 256 as const, frameHeight: 256 as const
});
export function hasBreadAnimations(scene: Scene): boolean {
    return (Object.keys(BREAD_ANIMATIONS) as BreadAnimation[]).every(state =>
        hasSpriteFrames(scene, breadSheet(state), { start: 0, end: 3, ...BREAD_ANIMATIONS[state] }) && scene.anims.exists(`bread:${state}`));
}
export function loadBreadAnimations(scene: Scene): void {
    for (const state of Object.keys(BREAD_ANIMATIONS) as BreadAnimation[]) {
        const sheet = breadSheet(state);
        scene.load.spritesheet(sheet.key, sheet.path, { frameWidth: 256, frameHeight: 256, startFrame: 0, endFrame: 3 });
    }
}
export function registerBreadAnimations(scene: Scene): void {
    for (const state of Object.keys(BREAD_ANIMATIONS) as BreadAnimation[]) {
        const clip = BREAD_ANIMATIONS[state], sheet = breadSheet(state);
        if (scene.anims.exists(sheet.key) || !hasSpriteFrames(scene, sheet, { start: 0, end: 3, ...clip })) continue;
        scene.anims.create({ key: sheet.key, frames: scene.anims.generateFrameNumbers(sheet.key, { start: 0, end: 3 }),
            frameRate: clip.fps, repeat: clip.repeat });
    }
}
