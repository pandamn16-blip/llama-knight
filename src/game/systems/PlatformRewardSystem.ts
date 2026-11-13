import { Scenes } from 'phaser';
import type { Scene, GameObjects } from 'phaser';
import { WORLD } from '../config/world';
import { generateSection, sectionWindow } from '../world/sections';
import type { RunState } from '../state/RunState';
import type { Player } from '../entities/Player';

// Deterministic, once-per-run elevated gems; collection persists across unloading.
export class PlatformRewardSystem {
    private active = new Map<string, { sprite: GameObjects.Container; value: number }>();
    private collected = new Set<string>();
    constructor(private scene: Scene, private run: RunState, private player: Pick<Player, 'x' | 'y'>,
        private groundY: number, private award: (value: number) => void) {
        scene.events.once(Scenes.Events.SHUTDOWN, this.destroy, this);
    }
    prepare(): void {
        const camera = this.scene.cameras.main;
        const retain = camera.width * WORLD.cleanupViewports;
        for (const [id, gem] of this.active) {
            if (gem.sprite.x < camera.scrollX - retain || gem.sprite.x > camera.scrollX + camera.width + retain) {
                gem.sprite.destroy(); this.active.delete(id);
            }
        }
        const win = sectionWindow(camera.scrollX, camera.width, WORLD.preparationViewports);
        for (let index = win.first; index <= win.last; index++) {
            const section = generateSection(index, this.run.seed);
            // One prize per upper route. Alternate heights, no extras on the tutorial's first ledge.
            for (const [slot, platform] of section.platforms.entries()) {
                if (slot % 2 !== 0 || (index === 0 && slot === 0)) continue;
                const id = `${platform.id}:gem`;
                if (this.collected.has(id) || this.active.has(id)) continue;
                if (platform.x < camera.scrollX - retain || platform.x > camera.scrollX + camera.width + retain) continue;
                const sprite = this.scene.add.container(platform.x, this.groundY - platform.height - 32)
                    .setDepth(7).setScrollFactor(1);
                sprite.add(this.scene.add.rectangle(0, 0, 17, 17, 0xffdc70)
                    .setAngle(45).setStrokeStyle(2, 0xffffff));
                this.active.set(id, { sprite, value: 1 });
            }
        }
    }
    update(): void {
        if (this.run.phase !== 'playing') return;
        this.prepare();
        for (const [id, gem] of this.active) {
            if (Math.hypot(gem.sprite.x - this.player.x, gem.sprite.y - this.player.y) > 37) continue;
            this.collected.add(id); gem.sprite.destroy(); this.active.delete(id);
            this.award(gem.value);
            if (this.run.phase !== 'playing') break;
        }
    }
    destroy(): void {
        this.scene.events.off(Scenes.Events.SHUTDOWN, this.destroy, this);
        for (const gem of this.active.values()) gem.sprite.destroy();
        this.active.clear(); this.collected.clear();
    }
}
