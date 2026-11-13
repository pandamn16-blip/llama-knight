import * as Phaser from 'phaser';
import { WORLD } from '../config/world';
import { BALANCE } from '../config/balance';
import type { RunState } from '../state/RunState';
import { breadPlacementId, generateSection, sectionSeed, sectionWindow } from '../world/sections';

export type Enemy = { sprite: Phaser.GameObjects.Container; speed: number; hp: number; placementX: number; placementId: string };
type EnemyRecord = { hp: number; speed: number; defeated: boolean };

export class EnemySystem {
    private items: Enemy[] = [];
    // Run-long lightweight records; only nearby records have live sprites.
    private records = new Map<string, EnemyRecord>();

    constructor(private scene: Phaser.Scene, private run: RunState, private groundY: number) {
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    }

    get enemies(): readonly Enemy[] { return this.items; }

    damage(enemy: Enemy, amount: number): boolean {
        const record = this.records.get(enemy.placementId)!;
        if (record.defeated || !this.items.includes(enemy)) return false;
        enemy.hp -= amount;
        record.hp = enemy.hp;
        if (enemy.hp > 0) return false;
        record.defeated = true;
        enemy.sprite.destroy();
        this.items.splice(this.items.indexOf(enemy), 1);
        return true;
    }

    prepare(): void {
        const camera = this.scene.cameras.main;
        // Very large range upgrades must not lose valid targets to streaming.
        const buffer = Math.max(camera.width * WORLD.preparationViewports, this.run.weapon.range);
        const cleanup = Math.max(camera.width * WORLD.cleanupViewports, buffer);
        for (let i = this.items.length - 1; i >= 0; i--) {
            const enemy = this.items[i];
            if (enemy.sprite.x < camera.scrollX - cleanup || enemy.sprite.x > camera.scrollX + camera.width + cleanup) {
                this.records.get(enemy.placementId)!.hp = enemy.hp;
                enemy.sprite.destroy();
                this.items.splice(i, 1);
            }
        }
        const active = new Set(this.items.map(enemy => enemy.placementId));
        const window = sectionWindow(camera.scrollX, camera.width, buffer / camera.width);
        for (let index = window.first; index <= window.last; index++) {
            for (const { id, x } of generateSection(index, this.run.seed).enemies) {
                if (x >= camera.scrollX - buffer && x <= camera.scrollX + camera.width + buffer &&
                    !active.has(id) && !this.records.get(id)?.defeated) this.spawnBread(x, id);
            }
        }
    }

    update(_dt: number, onContactCheck: (enemy: Enemy) => void): void {
        if (this.run.phase !== 'playing') return;
        const camera = this.scene.cameras.main;
        // Preparation is spatial, never gated by the runner's timed spawn interval.
        this.prepare();
        for (const enemy of this.items) {
            // Render/contact culling never changes the saved world state.
            const visible = enemy.sprite.x >= camera.scrollX - 80 &&
                enemy.sprite.x <= camera.scrollX + camera.width + 80;
            if (enemy.sprite.visible !== visible) enemy.sprite.setVisible(visible);
            if (!visible) continue; // Distant prepared occupants have no per-frame contact/AI work.
            onContactCheck(enemy);
            if (this.run.phase !== 'playing') return;
        }
    }

    private spawnBread(worldX: number = WORLD.enemyStartX, id = breadPlacementId(this.run.seed, worldX)) {
        const existing = this.items.find(enemy => enemy.placementId === id);
        if (existing) return existing;
        let record = this.records.get(id);
        if (record?.defeated) return;
        if (!record) {
            const difficulty = Math.floor(this.run.runTime / BALANCE.enemy.difficultySeconds);
            const speedRoll = sectionSeed(this.run.seed, worldX) / 0x100000000;
            record = {
                speed: BALANCE.enemy.minSpeed + Math.floor(speedRoll * (BALANCE.enemy.maxSpeed - BALANCE.enemy.minSpeed + 1)) +
                    difficulty * BALANCE.enemy.speedPerDifficulty,
                hp: BALANCE.enemy.initialHealth + Math.floor(difficulty / BALANCE.enemy.difficultyPerHealth),
                defeated: false
            };
            this.records.set(id, record);
        }
        const sprite = this.scene.add.container(worldX, this.groundY - BALANCE.enemy.groundOffset).setDepth(6);
        sprite.add([
            this.scene.add.rectangle(0, 0, 57, 65, 0x9c612f).setStrokeStyle(3, 0x563718),
            this.scene.add.rectangle(0, 0, 46, 54, 0xeac38b),
            this.scene.add.circle(-11, -7, 3, 0x2d211b),
            this.scene.add.circle(11, -7, 3, 0x2d211b),
            this.scene.add.ellipse(0, 12, 13, 5, 0x4c2e22)
        ]);
        sprite.setScrollFactor(1, 1, true);
        const camera = this.scene.cameras.main;
        sprite.setVisible(worldX >= camera.scrollX - 80 && worldX <= camera.scrollX + camera.width + 80);
        // Retain the existing speed metadata for later behaviour; no runner drift is applied.
        const enemy = { sprite, speed: record.speed, hp: record.hp, placementX: worldX, placementId: id };
        this.items.push(enemy);
        return enemy;
    }

    destroy(): void {
        this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
        for (const enemy of this.items) if (enemy.sprite.active) enemy.sprite.destroy();
        this.items = [];
        this.records.clear();
    }
}
