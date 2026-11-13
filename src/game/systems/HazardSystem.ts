import * as Phaser from 'phaser';
import { WORLD } from '../config/world';
import { BALANCE } from '../config/balance';
import { generateSection, sectionWindow } from '../world/sections';
import type { HazardPlacement } from '../world/hazards';
import type { RunState } from '../state/RunState';
import type { Player } from '../entities/Player';
import type { Enemy, EnemySystem } from './EnemySystem';
import type { Archer, ArcherSystem } from './ArcherSystem';

type Hazard = {
    placement: HazardPlacement;
    pieces: Phaser.GameObjects.Rectangle[];
    trapHits: number;
    enemyCaptive?: { id: string; releaseAt: number };
};
const cooldown = BALANCE.player.damageCooldown / 1000;

// Uses game simulation time, not Phaser timers: pause, streaming, replay and
// rapidly repeated hits all follow the same deterministic rules.
export class HazardSystem {
    private active = new Map<string, Hazard>();
    private broken = new Set<string>();
    private enemyTrappedUntil = new Map<string, number>();
    private lastEnemyHit = new Map<string, number>();
    private playerTrap?: string;
    private attackWasHeld = false;

    constructor(private scene: Phaser.Scene, private run: RunState,
        private groundY: number, private player: Player,
        private enemies: EnemySystem, private archers: ArcherSystem,
        private hurtPlayer: (amount: number) => boolean) {
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    }

    get isPlayerTrapped(): boolean { return this.playerTrap !== undefined; }
    isEnemyTrapped(id: string): boolean {
        return (this.enemyTrappedUntil.get(id) ?? -Infinity) > this.run.runTime;
    }

    private make(placement: HazardPlacement): Hazard {
        const x = placement.x, y = this.groundY;
        const pieces: Phaser.GameObjects.Rectangle[] = [];
        const rect = (dx: number, dy: number, width: number, height: number, color: number) => {
            pieces.push(this.scene.add.rectangle(x + dx, y + dy, width, height, color).setDepth(5));
        };
        if (placement.kind === 'snap-trap') {
            rect(0, -3, 46, 6, 0x64534b);
            rect(-17, -11, 9, 16, 0xb8bcc6);
            rect(17, -11, 9, 16, 0xb8bcc6);
            rect(0, -4, 13, 6, 0xe2a24b);
        } else {
            rect(0, -2, 64, 5, 0x554a48);
            for (const offset of [-24, -8, 8, 24]) {
                rect(offset, -11, 10, 18, placement.kind === 'timed-spikes' ? 0xc8a65d : 0xc3cad0);
            }
        }
        return { placement, pieces, trapHits: 0 };
    }

    prepare(): void {
        const camera = this.scene.cameras.main;
        const window = sectionWindow(camera.scrollX, camera.width, WORLD.preparationViewports);
        const keep = sectionWindow(camera.scrollX, camera.width, WORLD.cleanupViewports);
        for (const [id, hazard] of this.active) {
            const section = Math.floor(hazard.placement.x / WORLD.sectionLength);
            if (section >= keep.first && section <= keep.last) continue;
            if (this.playerTrap === id) continue;
            hazard.pieces.forEach(piece => piece.destroy());
            this.active.delete(id);
        }
        for (let i = window.first; i <= window.last; i++) {
            for (const placement of generateSection(i, this.run.seed).hazards) {
                if (this.broken.has(placement.id) || this.active.has(placement.id)) continue;
                this.active.set(placement.id, this.make(placement));
            }
        }
    }

    private timedActive(hazard: Hazard): boolean {
        if (hazard.placement.kind !== 'timed-spikes') return true;
        const phase = (this.run.runTime + (hazard.placement.x % 17) / 17) % 3.4;
        return phase < 1.0;
    }

    private updateVisual(hazard: Hazard): void {
        if (hazard.placement.kind === 'timed-spikes') {
            const phase = (this.run.runTime + (hazard.placement.x % 17) / 17) % 3.4;
            const opacity = phase < 1 ? 1 : phase < 1.4 ? 0.6 : 0.16;
            hazard.pieces.forEach((part, index) => { if (index > 0) part.setAlpha(opacity); });
        } else if (hazard.placement.kind === 'snap-trap' && hazard.trapHits) {
            hazard.pieces.forEach(part => part.setAlpha(Math.max(0.35, 1 - hazard.trapHits * 0.2)));
        }
    }

    private breakTrap(hazard: Hazard): void {
        this.broken.add(hazard.placement.id);
        if (this.playerTrap === hazard.placement.id) this.playerTrap = undefined;
        hazard.pieces.forEach(piece => piece.destroy());
        this.active.delete(hazard.placement.id);
    }

    // An attack press is deliberately counted once per button press, regardless
    // of weapon level/damage. Both Llama Crunch and Candy can always escape.
    handlePlayerAttack(pressed: boolean): boolean {
        const fresh = pressed && !this.attackWasHeld;
        this.attackWasHeld = pressed;
        const trapped = this.playerTrap;
        if (!trapped) return false;
        const hazard = this.active.get(trapped);
        if (!hazard) { this.playerTrap = undefined; return false; }
        if (fresh) {
            hazard.trapHits++;
            this.updateVisual(hazard);
            if (hazard.trapHits >= 3) this.breakTrap(hazard);
        }
        return true;
    }

    private hitEnemy(enemy: Enemy | Archer): void {
        const id = 'placementId' in enemy ? enemy.placementId : enemy.id;
        if (this.isEnemyTrapped(id) || this.run.runTime -
            (this.lastEnemyHit.get(id) ?? -Infinity) < cooldown) return;
        this.lastEnemyHit.set(id, this.run.runTime);
        if ('placementId' in enemy) this.enemies.damage(enemy, 1);
        else this.archers.damage(enemy, 1);
    }

    update(): void {
        if (this.run.phase !== 'playing') return;
        this.prepare();
        for (const [id, end] of this.enemyTrappedUntil) {
            if (end <= this.run.runTime) this.enemyTrappedUntil.delete(id);
        }
        const foot = this.player.y + BALANCE.player.groundOffset;
        for (const hazard of this.active.values()) {
            this.updateVisual(hazard);
            const x = hazard.placement.x;
            const onGround = Math.abs(foot - this.groundY) <= 7;
            const playerNear = onGround && Math.abs(this.player.x - x) <=
                (hazard.placement.kind === 'snap-trap' ? 21 : 30);
            if (hazard.placement.kind === 'snap-trap') {
                if (playerNear && !this.playerTrap) {
                    this.playerTrap = hazard.placement.id;
                    this.run.velocityY = 0;
                    this.run.onGround = true;
                    this.hurtPlayer(1);
                }
            } else if (this.timedActive(hazard) && playerNear) {
                this.hurtPlayer(1);
            }
            // Enemies are affected by the same traps/spikes. A captured enemy
            // is held briefly then automatically struggles free; no infinite AI lock.
            if (!this.timedActive(hazard)) continue;
            for (const enemy of [...this.enemies.enemies, ...this.archers.archers]) {
                const enemyX = enemy.sprite.x, enemyY = enemy.sprite.y;
                if (Math.abs(enemyX - x) > 27 ||
                    Math.abs(enemyY - (this.groundY - BALANCE.enemy.groundOffset)) > 38) continue;
                const enemyId = 'placementId' in enemy ? enemy.placementId : enemy.id;
                if (hazard.placement.kind === 'snap-trap') {
                    if (!this.isEnemyTrapped(enemyId)) {
                        this.hitEnemy(enemy);
                        this.enemyTrappedUntil.set(enemyId, this.run.runTime + 2.5);
                        this.breakTrap(hazard);
                        break;
                    }
                } else this.hitEnemy(enemy);
            }
        }
    }

    destroy(): void {
        this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
        for (const hazard of this.active.values()) hazard.pieces.forEach(piece => piece.destroy());
        this.active.clear();
        this.broken.clear();
        this.enemyTrappedUntil.clear();
        this.lastEnemyHit.clear();
        this.playerTrap = undefined;
    }
}
