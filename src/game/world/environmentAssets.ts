import type { Scene } from 'phaser';

// Toggle individual entries to enabled:true after adding the matching PNG/WebP.
// Missing/disabled textures always fall back to coloured terrain shapes.
export const ENVIRONMENT_ASSETS = {
    breadlands: {
        terrain: {
            groundTop: { key: 'breadlands:ground-top', path: 'environments/breadlands/terrain/ground-top.png', enabled: false },
            groundFill: { key: 'breadlands:ground-fill', path: 'environments/breadlands/terrain/ground-fill.png', enabled: false },
            platformLeft: { key: 'breadlands:platform-left', path: 'environments/breadlands/terrain/platform-left.png', enabled: false },
            platformMiddle: { key: 'breadlands:platform-middle', path: 'environments/breadlands/terrain/platform-middle.png', enabled: false },
            platformRight: { key: 'breadlands:platform-right', path: 'environments/breadlands/terrain/platform-right.png', enabled: false }
        },
        decorations: {
            arch: { key: 'breadlands:arch', path: 'environments/breadlands/decorations/arch.png', enabled: false },
            watchtower: { key: 'breadlands:watchtower', path: 'environments/breadlands/decorations/watchtower.png', enabled: false },
            ruins: { key: 'breadlands:ruins', path: 'environments/breadlands/decorations/ruins.png', enabled: false },
            fence: { key: 'breadlands:fence', path: 'environments/breadlands/decorations/fence.png', enabled: false },
            boulders: { key: 'breadlands:boulders', path: 'environments/breadlands/decorations/boulders.png', enabled: false },
            sign: { key: 'breadlands:sign', path: 'environments/breadlands/decorations/sign.png', enabled: false }
        },
        backgrounds: {
            sky: { key: 'breadlands:sky', path: 'environments/breadlands/backgrounds/sky.png', enabled: false, scrollFactor: 0 },
            hills: { key: 'breadlands:hills', path: 'environments/breadlands/backgrounds/distant-hills.png', enabled: false, scrollFactor: 0.18 }
        }
    }
} as const;

export function loadEnvironmentArt(scene: Scene): void {
    const group = ENVIRONMENT_ASSETS.breadlands;
    for (const entry of [...Object.values(group.terrain), ...Object.values(group.decorations), ...Object.values(group.backgrounds)]) {
        if (entry.enabled) scene.load.image(entry.key, entry.path);
    }
}

export function terrainTexture(scene: Scene, key: string): boolean {
    return scene.textures?.exists(key) === true;
}
