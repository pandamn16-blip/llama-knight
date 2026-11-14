import type { Scene } from 'phaser';
import { hasSpriteFrames } from '../rendering/spriteAssets';

export const SWORD_SLASH_EFFECT = {
    key: 'weapon:sword-slash', path: 'weapons/sword-slash/effect.png',
    width: 1280, height: 256, frameWidth: 256, frameHeight: 256,
    animationKey: 'weapon:sword-slash:play', start: 0, end: 4, fps: 18, repeat: 0
} as const;

export const CANDY_PROJECTILE_EFFECT = {
    key: 'weapon:candy-projectile', path: 'characters/candy/projectile.png',
    width: 1536, height: 256, frameWidth: 256, frameHeight: 256,
    animationKey: 'weapon:candy-projectile:play', start: 0, end: 5, fps: 16, repeat: -1
} as const;

export function hasCandyProjectileEffect(scene: Scene): boolean {
    return hasSpriteFrames(scene, CANDY_PROJECTILE_EFFECT, CANDY_PROJECTILE_EFFECT) &&
        scene.anims.exists(CANDY_PROJECTILE_EFFECT.animationKey);
}

export function loadWeaponEffects(scene: Scene): void {
    const effect = SWORD_SLASH_EFFECT;
    scene.load.spritesheet(effect.key, effect.path, {
        frameWidth: effect.frameWidth, frameHeight: effect.frameHeight,
        startFrame: effect.start, endFrame: effect.end
    });
    const candy = CANDY_PROJECTILE_EFFECT;
    scene.load.spritesheet(candy.key, candy.path, {
        frameWidth: candy.frameWidth, frameHeight: candy.frameHeight,
        startFrame: candy.start, endFrame: candy.end
    });
}

export function hasSwordSlashEffect(scene: Scene): boolean {
    return hasSpriteFrames(scene, SWORD_SLASH_EFFECT, SWORD_SLASH_EFFECT) &&
        scene.anims.exists(SWORD_SLASH_EFFECT.animationKey);
}

export function registerWeaponEffects(scene: Scene): void {
    for (const effect of [SWORD_SLASH_EFFECT, CANDY_PROJECTILE_EFFECT]) {
        if (!hasSpriteFrames(scene, effect, effect) || scene.anims.exists(effect.animationKey)) continue;
        scene.anims.create({ key: effect.animationKey,
            frames: scene.anims.generateFrameNumbers(effect.key, { start: effect.start, end: effect.end }),
            frameRate: effect.fps, repeat: effect.repeat
        });
    }
}
