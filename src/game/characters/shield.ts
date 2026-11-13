import type { Scene } from 'phaser';
import type { CharacterVisual } from './definitions';

export const SHIELD = { movementMultiplier: 0.45, impactMs: 140 } as const;
// Native source cells verified from the supplied file. Uniform visual scaling only.
export const CHARACTER_SHIELDS: Partial<Record<CharacterVisual, {
    key: string; path: string; width: number; height: number; frameSize: number; frames: number;
    fps: number; holdFrame: number; scale: number; originX: number; originY: number; offsetX: number; offsetY: number
}>> = {
    llama: { key: 'llama-crunch:shield', path: 'characters/llama-crunch/shield.png', width: 2172, height: 724,
        frameSize: 724, frames: 3, fps: 6, holdFrame: 1, scale: 128 / 724, originX: 0.5, originY: 0.92, offsetX: 0, offsetY: 40 }
};
export function hasShieldSheet(scene: Scene, visual: CharacterVisual): boolean {
    const sheet = CHARACTER_SHIELDS[visual];
    if (!sheet || !scene.textures?.exists(sheet.key) || !scene.anims.exists(sheet.key)) return false;
    const texture = scene.textures.get(sheet.key), image = texture.getSourceImage();
    return image.width === sheet.width && image.height === sheet.height &&
        Array.from({ length: sheet.frames }, (_, i) => i).every(i => texture.has(String(i)) &&
            texture.get(i).width === sheet.frameSize && texture.get(i).height === sheet.frameSize);
}
export function loadShieldSheets(scene: Scene): void {
    for (const sheet of Object.values(CHARACTER_SHIELDS)) scene.load.spritesheet(sheet.key, sheet.path,
        { frameWidth: sheet.frameSize, frameHeight: sheet.frameSize, startFrame: 0, endFrame: sheet.frames - 1 });
}
export function registerShieldAnimations(scene: Scene): void {
    for (const sheet of Object.values(CHARACTER_SHIELDS)) {
        if (scene.anims.exists(sheet.key) || !scene.textures?.exists(sheet.key)) continue;
        const texture = scene.textures.get(sheet.key), image = texture.getSourceImage();
        if (image.width !== sheet.width || image.height !== sheet.height || !texture.has(String(sheet.frames - 1))) continue;
        scene.anims.create({ key: sheet.key, frames: scene.anims.generateFrameNumbers(sheet.key, { start: 0, end: sheet.holdFrame }),
            frameRate: sheet.fps, repeat: 0 });
    }
}
