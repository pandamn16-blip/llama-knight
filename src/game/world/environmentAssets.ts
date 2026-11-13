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
        backgrounds: {
            sky: { key: 'breadlands:sky', path: 'environments/breadlands/backgrounds/sky.png', enabled: false, scrollFactor: 0 },
            hills: { key: 'breadlands:hills', path: 'environments/breadlands/backgrounds/distant-hills.png', enabled: false, scrollFactor: 0.18 }
        }
    }
} as const;

export function loadEnvironmentArt(scene: Scene): void {
    const group = ENVIRONMENT_ASSETS.breadlands;
    for (const entry of [...Object.values(group.terrain), ...Object.values(group.backgrounds)]) {
        if (entry.enabled) scene.load.image(entry.key, entry.path);
    }
}

export function terrainTexture(scene: Scene, key: string): boolean {
    return scene.textures?.exists(key) === true;
}
