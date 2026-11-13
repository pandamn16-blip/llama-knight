import { Scenes } from 'phaser';
import type { Scene } from 'phaser';

export function isMobileLayout(): boolean {
    const touchPointer = window.matchMedia('(pointer: coarse)').matches && window.matchMedia('(hover: none)').matches;
    // Safari can report different pointer capabilities with desktop-site/accessory settings.
    const touchDevice = (window.navigator?.maxTouchPoints ?? 0) > 0 &&
        /iPhone|iPad|iPod|Android|Macintosh/i.test(window.navigator?.userAgent ?? '');
    return touchPointer || touchDevice;
}

// Fixed vertical world scale/ground/physics; only the horizontal view expands.
export function viewportWidth(width: number, height: number, mobile: boolean): number {
    return mobile && width > height && height > 0 ? Math.max(1024, Math.round(768 * width / height)) : 1024;
}

export function onLayoutResize(scene: Scene, layout: () => void): () => void {
    const stop = () => {
        scene.scale.off('resize', layout);
        scene.events.off(Scenes.Events.SHUTDOWN, stop);
    };
    scene.scale.on('resize', layout);
    scene.events.once(Scenes.Events.SHUTDOWN, stop);
    return stop;
}

// Must be called from a user gesture. Unsupported/denied requests keep the CSS viewport.
export function requestMobileFullscreen(): void {
    if (!isMobileLayout() || !document.fullscreenEnabled || document.fullscreenElement) return;
    document.getElementById('app')?.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
}
