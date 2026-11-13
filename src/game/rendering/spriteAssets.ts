import type { Scene } from 'phaser';

// Shared authoring contract for playable characters and future enemy artwork.
// Never use these visual dimensions as gameplay collision dimensions.
export const SPRITE_FRAME = { width: 256, height: 256, footX: 128, footY: 224 } as const;
export const FOOT_ORIGIN = { x: SPRITE_FRAME.footX / SPRITE_FRAME.width, y: SPRITE_FRAME.footY / SPRITE_FRAME.height } as const;
export const ACTOR_ANIMATIONS = ['idle', 'run', 'jump', 'fall', 'attack', 'hurt', 'death'] as const;
export type ActorAnimation = typeof ACTOR_ANIMATIONS[number];
export interface VisualTransform {
    scale: number;
    originX: number;
    originY: number;
    offsetX: number;
    offsetY: number;
}
export interface SpriteSheetSource {
    key: string;
    path: string; // Relative to assets/.
    width: number;
    height: number;
    frameWidth: typeof SPRITE_FRAME.width;
    frameHeight: typeof SPRITE_FRAME.height;
}
export interface AnimationClip { start: number; end: number; fps: number; repeat: number; includesWeaponEffect?: boolean }

// One sheet per state is preferred. Combined sheets remain a supported legacy format.
export type ActorSpritePack = VisualTransform & { key: string } & (
    (SpriteSheetSource & { format: 'combined'; animations: Record<ActorAnimation, AnimationClip> }) |
    { format: 'separate'; animations: Record<ActorAnimation, AnimationClip & { sheet: SpriteSheetSource; fallback?: AnimationClip & { sheet: SpriteSheetSource } }> }
);

export function animationSource(pack: ActorSpritePack, state: ActorAnimation): SpriteSheetSource {
    return pack.format === 'separate' ? pack.animations[state].sheet : pack;
}

export function hasSpriteFrames(scene: Scene, source: SpriteSheetSource, clip: AnimationClip): boolean {
    if (source.frameWidth !== SPRITE_FRAME.width || source.frameHeight !== SPRITE_FRAME.height ||
        source.width <= 0 || source.height <= 0 || source.width % SPRITE_FRAME.width !== 0 ||
        source.height % SPRITE_FRAME.height !== 0 || !Number.isInteger(clip.start) ||
        !Number.isInteger(clip.end) || clip.start < 0 || clip.end < clip.start ||
        clip.end >= (source.width / SPRITE_FRAME.width) * (source.height / SPRITE_FRAME.height)) return false;
    if (!scene.textures?.exists(source.key)) return false;
    const texture = scene.textures.get(source.key);
    const image = texture.getSourceImage();
    if (image.width !== source.width || image.height !== source.height) return false;
    for (let frame = clip.start; frame <= clip.end; frame++) {
        if (!texture.has(String(frame))) return false;
        const size = texture.get(frame);
        if (size.width !== SPRITE_FRAME.width || size.height !== SPRITE_FRAME.height) return false;
    }
    return true;
}
