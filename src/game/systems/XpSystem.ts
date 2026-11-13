import * as Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import type { RunState } from '../state/RunState';
import type { Player } from '../entities/Player';
import { WORLD } from '../config/world';
import { sectionWindow } from '../world/sections';

type Gem = { id: number; sprite: Phaser.GameObjects.Container; value: number };
type StoredGem = { id: number; x: number; y: number; value: number };

export class XpSystem {
    private gems: Gem[] = [];
    private dormant = new Map<number, StoredGem[]>();
    private nextGemId = 0;

    constructor(
        private scene: Phaser.Scene, private run: RunState, private player: Player,
        private onLevelUp: () => void, private onChanged: () => void
    ) {
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    }

    xpNeeded(): number { return BALANCE.xp.initialThreshold + (this.run.level - 1) * BALANCE.xp.thresholdPerLevel; }

    checkLevelUp(): void {
        if (this.run.phase !== 'playing' || this.run.xp < this.xpNeeded()) return;
        this.run.xp -= this.xpNeeded();
        this.run.level++;
        this.run.phase = 'choosingUpgrade';
        this.onLevelUp();
    }

    dropGem(x: number, y: number) {
        if (this.run.phase !== 'playing') return;
        this.createGem(x, y, BALANCE.xp.gemValue);
    }

    private createGem(x: number, y: number, value: number, id = this.nextGemId++): void {
        const sprite = this.scene.add.container(x, y).setDepth(7);
        const diamond = this.scene.add.rectangle(0, 0, 17, 17, 0x5ad7ff).setAngle(45).setStrokeStyle(2, 0xffffff);
        sprite.add(diamond);
        sprite.setScrollFactor(1, 1, true);
        this.gems.push({ id, sprite, value });
    }

    private prepare(): void {
        const camera = this.scene.cameras.main;
        // Attraction upgrades must still reach drops outside the camera window.
        const radius = this.run.magnetRadius;
        const left = Math.min(camera.scrollX - camera.width * WORLD.preparationViewports, this.player.x - radius);
        const right = Math.max(camera.scrollX + camera.width * (1 + WORLD.preparationViewports), this.player.x + radius);
        const first = Math.max(0, Math.floor(left / WORLD.sectionLength));
        const last = Math.floor(right / WORLD.sectionLength);
        for (let index = first; index <= last; index++) {
            const stored = this.dormant.get(index);
            if (!stored) continue;
            for (const gem of stored) this.createGem(gem.x, gem.y, gem.value, gem.id);
            this.dormant.delete(index);
        }
        const retain = sectionWindow(camera.scrollX, camera.width, WORLD.cleanupViewports);
        const retainLeft = Math.min(retain.first * WORLD.sectionLength, left);
        const retainRight = Math.max((retain.last + 1) * WORLD.sectionLength, right);
        for (let i = this.gems.length - 1; i >= 0; i--) {
            const gem = this.gems[i];
            if (gem.sprite.x >= retainLeft && gem.sprite.x <= retainRight) continue;
            const index = Math.max(0, Math.floor(gem.sprite.x / WORLD.sectionLength));
            const stored = this.dormant.get(index) ?? [];
            stored.push({ id: gem.id, x: gem.sprite.x, y: gem.sprite.y, value: gem.value });
            this.dormant.set(index, stored);
            gem.sprite.destroy();
            this.gems.splice(i, 1);
        }
    }

    private collectGem(index: number) {
        const gem = this.gems[index];
        gem.sprite.destroy();
        this.gems.splice(index, 1);
        this.run.xp += gem.value;
        this.checkLevelUp();
        this.onChanged();
    }

    update(dt: number): void {
        if (this.run.phase !== 'playing') return;
        this.prepare();
        for (let i = this.gems.length - 1; i >= 0; i--) {
            const gem = this.gems[i];
            const dx = this.player.x - gem.sprite.x;
            const dy = this.player.y - gem.sprite.y;
            const distance = Math.hypot(dx, dy);
            if (distance < this.run.magnetRadius && distance > BALANCE.xp.minAttractionDistance) {
                const step = Math.min(1, BALANCE.xp.attractionSpeed * dt / distance);
                gem.sprite.x += dx * step;
                gem.sprite.y += dy * step;
            }
            if (Math.hypot(this.player.x - gem.sprite.x, this.player.y - gem.sprite.y) < BALANCE.xp.pickupRadius) {
                this.collectGem(i);
                if (this.run.phase !== 'playing') break;
            } else if (gem.sprite.x < BALANCE.xp.despawnX) {
                gem.sprite.destroy(); this.gems.splice(i, 1);
            }
        }
    }

    destroy(): void {
        this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
        for (const gem of this.gems) if (gem.sprite.active) gem.sprite.destroy();
        this.gems = [];
        this.dormant.clear();
        this.nextGemId = 0;
    }
}
