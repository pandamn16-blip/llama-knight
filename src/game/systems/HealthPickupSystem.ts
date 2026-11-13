import { Scenes } from 'phaser';
import type { Scene, GameObjects } from 'phaser';
import type { RunState } from '../state/RunState';
import type { Player } from '../entities/Player';
import { WORLD } from '../config/world';
import { STRUCTURES } from '../config/structures';
import { sectionWindow } from '../world/sections';

type HealthRecord = { x: number; y: number; amount: number; collected: boolean };

export class HealthPickupSystem {
    private records = new Map<string, HealthRecord>();
    private sections = new Map<number, Set<string>>();
    private active = new Map<string, GameObjects.Container>();

    constructor(private scene: Scene, private run: RunState, private player: Player, private onChanged: () => void) {
        scene.events.once(Scenes.Events.SHUTDOWN, this.destroy, this);
    }

    drop(id: string, x: number, y: number, amount: number = STRUCTURES.healthPickup.amount): void {
        if (this.run.phase !== 'playing' || this.records.has(id)) return;
        this.records.set(id, { x, y, amount, collected: false });
        const section = Math.max(0, Math.floor(x / WORLD.sectionLength));
        const ids = this.sections.get(section) ?? new Set<string>();
        ids.add(id); this.sections.set(section, ids);
    }

    update(): void {
        if (this.run.phase !== 'playing') return;
        const camera = this.scene.cameras.main;
        const window = sectionWindow(camera.scrollX, camera.width, WORLD.preparationViewports);
        const retain = camera.width * WORLD.cleanupViewports;
        for (const [id, sprite] of this.active) {
            if (sprite.x < camera.scrollX - retain || sprite.x > camera.scrollX + camera.width + retain) {
                sprite.destroy(); this.active.delete(id);
            }
        }
        for (let index = window.first; index <= window.last; index++) {
            for (const id of this.sections.get(index) ?? []) {
                if (this.active.has(id)) continue;
                const record = this.records.get(id)!;
                if (record.collected) continue;
                const sprite = this.scene.add.container(record.x, record.y).setDepth(7).setScrollFactor(1);
                sprite.add([
                    this.scene.add.rectangle(0, 0, 26, 26, 0xe65466).setStrokeStyle(2, 0xffe2d8),
                    this.scene.add.rectangle(0, 0, 6, 18, 0xffffff),
                    this.scene.add.rectangle(0, 0, 18, 6, 0xffffff)
                ]);
                this.active.set(id, sprite);
            }
        }
        for (const [id, sprite] of this.active) {
            sprite.setVisible(sprite.x >= camera.scrollX - 40 && sprite.x <= camera.scrollX + camera.width + 40);
            if (this.run.health >= this.run.maxHealth ||
                Math.hypot(sprite.x - this.player.x, sprite.y - this.player.y) >= STRUCTURES.healthPickup.radius) continue;
            const record = this.records.get(id)!;
            record.collected = true; // Commit before callbacks; this ID can never drop again.
            this.run.health = Math.min(this.run.maxHealth, this.run.health + record.amount);
            sprite.destroy(); this.active.delete(id);
            const section = Math.max(0, Math.floor(record.x / WORLD.sectionLength));
            const ids = this.sections.get(section)!; ids.delete(id);
            if (!ids.size) this.sections.delete(section);
            this.onChanged();
        }
    }

    destroy(): void {
        this.scene.events.off(Scenes.Events.SHUTDOWN, this.destroy, this);
        for (const sprite of this.active.values()) sprite.destroy();
        this.active.clear(); this.records.clear(); this.sections.clear();
    }
}
