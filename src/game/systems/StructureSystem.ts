import { Scenes } from 'phaser';
import type { Scene, GameObjects, Time, Tweens } from 'phaser';
import type { RunState } from '../state/RunState';
import { WORLD } from '../config/world';
import { STRUCTURES } from '../config/structures';
import { generateSection, sectionWindow } from '../world/sections';
import type { Player } from '../entities/Player';
import { isMobileLayout, onLayoutResize } from '../ui/layout';
import type { CratePlacement, ChestPlacement, ChestReward } from '../world/sections';

export type Crate = { sprite: GameObjects.Container; hp: number; placement: CratePlacement };
type CrateRecord = { hp: number; destroyed: boolean };

export class StructureSystem {
    private items: Crate[] = [];
    private records = new Map<string, CrateRecord>();
    private activeChests = new Map<string, { sprite: GameObjects.Container; placement: ChestPlacement }>();
    private opened = new Set<string>();
    private prompt?: GameObjects.Text;
    private timers = new Set<Time.TimerEvent>();
    private effects = new Set<GameObjects.Container>();
    private tweens = new Set<Tweens.Tween>();

    constructor(private scene: Scene, private run: RunState, private groundY: number,
        private onCrateDestroyed: (placement: CratePlacement, x: number, y: number) => void,
        private player?: Player, private onChestReward: (reward: ChestReward) => void = () => {}) {
        if (player) {
            const mobile = isMobileLayout();
            this.prompt = scene.add.text(scene.scale.width / 2, scene.scale.height - 112,
                mobile ? 'OPEN CHEST' : 'OPEN CHEST [E]', {
                    fontSize: mobile ? '30px' : '22px', color: '#fff0be', backgroundColor: '#453951',
                    padding: { x: 24, y: mobile ? 30 : 18 }
                }).setOrigin(0.5).setDepth(35).setScrollFactor(0).setVisible(false).setInteractive({ useHandCursor: true });
            this.prompt.on('pointerdown', () => this.interact());
            onLayoutResize(scene, () => this.prompt?.setPosition(scene.scale.width / 2, scene.scale.height - 112));
        }
        scene.events.once(Scenes.Events.SHUTDOWN, this.destroy, this);
    }

    get crates(): readonly Crate[] { return this.items; }

    prepare(): void {
        if (this.run.phase !== 'playing') return;
        const camera = this.scene.cameras.main;
        const buffer = Math.max(camera.width * WORLD.preparationViewports, this.run.weapon.range);
        const retain = Math.max(camera.width * WORLD.cleanupViewports, buffer);
        for (let i = this.items.length - 1; i >= 0; i--) {
            const crate = this.items[i];
            if (crate.sprite.x < camera.scrollX - retain || crate.sprite.x > camera.scrollX + camera.width + retain) {
                this.records.get(crate.placement.id)!.hp = crate.hp;
                crate.sprite.destroy(); this.items.splice(i, 1);
            }
        }
        for (const [id, chest] of this.activeChests) {
            if (chest.sprite.x < camera.scrollX - retain || chest.sprite.x > camera.scrollX + camera.width + retain) {
                chest.sprite.destroy(); this.activeChests.delete(id);
            }
        }
        const live = new Set(this.items.map(crate => crate.placement.id));
        const window = sectionWindow(camera.scrollX, camera.width, buffer / camera.width);
        for (let index = window.first; index <= window.last; index++) {
            for (const placement of generateSection(index, this.run.seed).structures) {
                if (placement.x < camera.scrollX - buffer || placement.x > camera.scrollX + camera.width + buffer ||
                    live.has(placement.id)) continue;
                if (placement.kind === 'chest') {
                    if (!this.activeChests.has(placement.id)) {
                        const chest = { placement, sprite: this.scene.add.container(placement.x, this.groundY - (placement.elevation ?? 0) - 24)
                            .setDepth(5).setScrollFactor(1) };
                        this.drawChest(chest); this.activeChests.set(placement.id, chest);
                    }
                    continue;
                }
                const record = this.records.get(placement.id) ?? { hp: STRUCTURES.crate.health, destroyed: false };
                if (record.destroyed) continue;
                this.records.set(placement.id, record);
                const sprite = this.scene.add.container(placement.x, this.groundY - STRUCTURES.crate.size / 2)
                    .setDepth(5).setScrollFactor(1);
                const crate = { placement, sprite, hp: record.hp };
                this.drawCrate(crate); this.items.push(crate); live.add(placement.id);
            }
        }
        for (const crate of this.items) crate.sprite.setVisible(crate.sprite.x >= camera.scrollX - 40 &&
            crate.sprite.x <= camera.scrollX + camera.width + 40);
        for (const chest of this.activeChests.values()) chest.sprite.setVisible(chest.sprite.x >= camera.scrollX - 50 &&
            chest.sprite.x <= camera.scrollX + camera.width + 50);
    }

    update(interactPressed = false): void {
        if (this.run.phase !== 'playing') { this.prompt?.setVisible(false); return; }
        this.prompt?.setVisible(!!this.nearestChest());
        if (interactPressed) this.interact();
    }

    private nearestChest() {
        if (!this.player) return undefined;
        let nearest: { sprite: GameObjects.Container; placement: ChestPlacement } | undefined;
        for (const chest of this.activeChests.values()) {
            if (this.opened.has(chest.placement.id) ||
                Math.abs(chest.sprite.x - this.player.x) > STRUCTURES.chest.range ||
                Math.abs(chest.sprite.y - this.player.y) > 64) continue;
            if (!nearest || Math.abs(chest.sprite.x - this.player.x) < Math.abs(nearest.sprite.x - this.player.x)) nearest = chest;
        }
        return nearest;
    }

    interact(): void {
        if (this.run.phase !== 'playing') return;
        const chest = this.nearestChest();
        if (!chest) return;
        this.opened.add(chest.placement.id); // Commit before rewards/modal callbacks or another pointer event.
        this.drawChest(chest); this.prompt?.setVisible(false);
        this.onChestReward(chest.placement.reward);
    }

    private drawChest(chest: { sprite: GameObjects.Container; placement: ChestPlacement }): void {
        const opened = this.opened.has(chest.placement.id);
        chest.sprite.removeAll(true);
        chest.sprite.add([
            this.scene.add.rectangle(0, 5, 74, 38, 0x89532d).setStrokeStyle(3, 0xe8bb61),
            this.scene.add.rectangle(0, opened ? -31 : -17, 74, 18, 0xb57a3a).setStrokeStyle(3, 0xe8bb61).setAngle(opened ? -18 : 0),
            this.scene.add.rectangle(0, opened ? -3 : 0, opened ? 60 : 12, opened ? 12 : 20, opened ? 0x342a31 : 0xffdc75)
        ]);
    }

    damageCrate(crate: Crate, amount: number): void {
        if (this.run.phase !== 'playing' || !this.items.includes(crate)) return;
        const record = this.records.get(crate.placement.id)!;
        if (record.destroyed) return;
        crate.hp -= amount; record.hp = crate.hp;
        if (crate.hp <= 0) {
            record.destroyed = true;
            const { x, y } = crate.sprite;
            crate.sprite.destroy(); this.items.splice(this.items.indexOf(crate), 1);
            this.breakEffect(x, y);
            this.onCrateDestroyed(crate.placement, x, y);
            return;
        }
        this.drawCrate(crate); crate.sprite.setAlpha(0.5);
        const timer = this.scene.time.delayedCall(STRUCTURES.crate.hitFlashMs, () => {
            this.timers.delete(timer); if (crate.sprite.active) crate.sprite.setAlpha(1);
        });
        this.timers.add(timer);
    }

    private drawCrate(crate: Crate): void {
        const size = STRUCTURES.crate.size;
        crate.sprite.removeAll(true);
        crate.sprite.add([
            this.scene.add.rectangle(0, 0, size, size, 0x9e6335).setStrokeStyle(3, 0x53371f),
            this.scene.add.rectangle(0, -19, size - 8, 7, 0xd99b5a),
            this.scene.add.rectangle(0, 19, size - 8, 7, 0xd99b5a),
            this.scene.add.rectangle(0, 0, 7, size - 8, 0xd99b5a).setAngle(45)
        ]);
        if (crate.hp < STRUCTURES.crate.health) crate.sprite.add([
            this.scene.add.rectangle(4, -4, 3, 30, 0x37291f).setAngle(25),
            this.scene.add.rectangle(-3, 10, 3, 17, 0x37291f).setAngle(-30)
        ]);
    }

    private breakEffect(x: number, y: number): void {
        const effect = this.scene.add.container(x, y).setDepth(8).setScrollFactor(1);
        for (const dx of [-20, 20]) for (const dy of [-15, 15]) {
            effect.add(this.scene.add.rectangle(dx, dy, 14, 8, 0xd99b5a).setAngle(dx + dy));
        }
        this.effects.add(effect);
        const tween = this.scene.tweens.add({ targets: effect, y: y - 18, alpha: 0,
            duration: STRUCTURES.crate.destructionMs,
            onComplete: () => { effect.destroy(); this.effects.delete(effect); this.tweens.delete(tween); } });
        this.tweens.add(tween);
    }

    destroy(): void {
        this.scene.events.off(Scenes.Events.SHUTDOWN, this.destroy, this);
        for (const crate of this.items) crate.sprite.destroy();
        for (const timer of this.timers) timer.remove(false);
        for (const tween of this.tweens) tween.remove();
        for (const effect of this.effects) effect.destroy();
        for (const chest of this.activeChests.values()) chest.sprite.destroy();
        this.activeChests.clear(); this.opened.clear(); this.prompt?.destroy();
        this.items = []; this.records.clear(); this.timers.clear(); this.tweens.clear(); this.effects.clear();
    }
}
