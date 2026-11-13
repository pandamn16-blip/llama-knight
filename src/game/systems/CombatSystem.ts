import * as Phaser from 'phaser';
import { SHIELD } from '../characters/shield';
import { BREAD } from '../enemies/bread';
import { BALANCE } from '../config/balance';
import type { RunState, RunPhase } from '../state/RunState';
import type { Player } from '../entities/Player';
import type { EnemySystem, Enemy } from './EnemySystem';
import type { StructureSystem, Crate } from './StructureSystem';
import { WEAPONS } from '../weapons/definitions';
import { SWORD_SLASH_EFFECT, hasSwordSlashEffect } from '../weapons/slashEffect';

type Projectile = { sprite: Phaser.GameObjects.Container; speed: number; remaining: number;
    damage: number; halfWidth: number; halfHeight: number; direction: -1 | 1 };

export class CombatSystem {
    private projectiles: Projectile[] = [];
    private timers = new Set<Phaser.Time.TimerEvent>();
    private tweens = new Set<Phaser.Tweens.Tween>();
    private slashes = new Set<Phaser.GameObjects.Container | Phaser.GameObjects.Sprite>();

    constructor(
        private scene: Phaser.Scene, private run: RunState, private player: Player,
        private enemySystem: EnemySystem, private onKill: (x: number, y: number) => void,
        private onDeath: () => void, private onChanged: () => void, private onDamage: () => void = () => {}, private structures?: StructureSystem
    ) {
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    }

    resolveEnemyAttack(enemy: Enemy): boolean {
        if (this.run.phase !== 'playing' || enemy.hp <= 0 || enemy.brain.state !== 'active' || enemy.brain.remaining <= 0) return false;
        const dx = (this.player.x - enemy.sprite.x) * enemy.brain.facing;
        if (dx < 0 || dx > BREAD.attackRange || Math.abs(enemy.sprite.y - this.player.y) > BREAD.attackHeight) return false;
        const sourceDirection = Math.sign(enemy.sprite.x - this.player.x) || -enemy.brain.facing;
        if (this.player.isShielding && sourceDirection === this.player.facing) this.blockImpact();
        else this.takeDamage();
        return true;
    }

    attack() {
        if (this.run.phase !== 'playing' || this.player.isShielding) return;
        if ((this.run.runTime * 1000) - this.run.weapon.lastAttack < this.run.weapon.cooldown) return;
        this.run.weapon.lastAttack = (this.run.runTime * 1000);
        const direction = this.player.facing;
        const definition = WEAPONS[this.run.weapon.id];
        const externalEffect = definition.kind === 'melee' && hasSwordSlashEffect(this.scene);
        const artworkIncludesSlash = this.player.showAttack();
        if (definition.kind === 'projectile') {
            const sprite = this.scene.add.container(this.player.x + 30 * direction, this.player.y).setDepth(7).setScrollFactor(1);
            sprite.add([
                this.scene.add.rectangle(0, 0, 20, 9, 0xffffff).setAngle(-20),
                this.scene.add.circle(0, 0, 8, 0xef73b6).setStrokeStyle(2, 0x84e9ef)
            ]);
            this.projectiles.push({ sprite, speed: definition.projectileSpeed,
                remaining: this.run.weapon.range, damage: this.run.weapon.damage,
                halfWidth: definition.hitHalfWidth, halfHeight: definition.hitHalfHeight, direction });
            return;
        }
        const range = this.run.weapon.range;
        const halfAngle = definition.arcHalfAngle * Math.PI / 180;
        if (externalEffect) {
            this.playSlashEffect(range, direction);
        } else if (!artworkIncludesSlash) {
            const arcStart = (direction === 1 ? 0 : Math.PI) - halfAngle;
            const arcEnd = (direction === 1 ? 0 : Math.PI) + halfAngle;
            const slash = this.scene.add.container(this.player.x, this.player.y).setDepth(7).setScrollFactor(1);
            // A bright crescent follows the same forward sector used by hit detection.
            const arc = this.scene.add.graphics();
            const innerRadius = Math.max(0, range - 20);
            arc.fillStyle(0xffe49c, 0.7);
            arc.beginPath();
            arc.moveTo(Math.cos(arcStart) * range, Math.sin(arcStart) * range);
            arc.arc(0, 0, range, arcStart, arcEnd, false);
            arc.lineTo(Math.cos(arcEnd) * innerRadius, Math.sin(arcEnd) * innerRadius);
            arc.arc(0, 0, innerRadius, arcEnd, arcStart, true);
            arc.closePath();
            arc.fillPath();
            // Blade and crossguard keep the effect recognisably sword-shaped.
            slash.add([
                arc,
                this.scene.add.rectangle(direction * range * 0.45, 0, range * 0.8, 7, 0xf4faff),
                this.scene.add.rectangle(direction * 12, 0, 6, 25, 0xe8b850),
                this.scene.add.rectangle(direction * 2, 0, 15, 7, 0x76513c)
            ]);
            this.slashes.add(slash);
            const tween = this.scene.tweens.add({ targets: slash, alpha: 0, duration: BALANCE.effects.slashDuration,
                onComplete: () => { slash.destroy(); this.slashes.delete(slash); this.tweens.delete(tween); } });
            this.tweens.add(tween);
        }
        const targets = this.targets;
        for (let i = targets.length - 1; i >= 0; i--) {
            const enemy = targets[i];
            const dx = (enemy.sprite.x - this.player.x) * direction;
            const dy = enemy.sprite.y - this.player.y;
            // Resolve each enemy once at swing time; the fading arc deals no extra hits.
            if (dx >= 0 && Math.hypot(dx, dy) < range && Math.abs(Math.atan2(dy, dx)) <= halfAngle) {
                this.hitTarget(enemy, this.run.weapon.damage);
            }
        }
    }

    private playSlashEffect(range: number, direction: -1 | 1): void {
        const effect = SWORD_SLASH_EFFECT;
        // Centre the effect canvas over [0, range] in the attack direction.
        // Uniform scaling preserves the artwork; only its visual footprint changes.
        const slash = this.scene.add.sprite(this.player.x + direction * range / 2,
            this.player.y, effect.key, effect.start).setDepth(7).setScrollFactor(1)
            .setOrigin(0.5, 0.5).setScale(range / effect.frameWidth).setFlipX(direction === -1);
        this.slashes.add(slash);
        slash.once('animationcomplete', () => {
            this.slashes.delete(slash);
            slash.destroy();
        });
        slash.play(effect.animationKey);
    }

    setVisualPhase(phase: RunPhase): void {
        for (const slash of this.slashes) {
            if (phase === 'gameOver') {
                slash.destroy();
                this.slashes.delete(slash);
            } else if ('anims' in slash) {
                if (phase === 'playing') slash.anims.resume();
                else slash.anims.pause();
            }
        }
    }

    // Called before enemy movement, in the same update slot as the melee attack.
    update(dt: number): void {
        if (this.run.phase !== 'playing') return;
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const shot = this.projectiles[i];
            const fromX = shot.sprite.x;
            const step = Math.min(shot.remaining, shot.speed * dt);
            const toX = fromX + step * shot.direction;
            let target: Enemy | Crate | undefined;
            // Sweep the segment so a fast shot cannot skip a thin enemy between frames.
            // Hit the nearest enemy along the path, regardless of spawn array order.
            for (const enemy of this.targets) {
                if (Math.abs(enemy.sprite.y - shot.sprite.y) < shot.halfHeight &&
                    enemy.sprite.x + shot.halfWidth >= Math.min(fromX, toX) &&
                    enemy.sprite.x - shot.halfWidth <= Math.max(fromX, toX) &&
                    (!target || (enemy.sprite.x - target.sprite.x) * shot.direction < 0)) target = enemy;
            }
            shot.sprite.x = toX;
            shot.remaining -= step;
            if (target) this.hitTarget(target, shot.damage);
            if (target || shot.remaining <= 0 || shot.sprite.x > this.scene.cameras.main.scrollX + this.scene.cameras.main.width + 50 ||
                shot.sprite.x < this.scene.cameras.main.scrollX - 50) {
                shot.sprite.destroy();
                this.projectiles.splice(i, 1);
            }
        }
    }

    private get targets(): readonly (Enemy | Crate)[] {
        return this.structures ? [...this.enemySystem.enemies, ...this.structures.crates] : this.enemySystem.enemies;
    }

    private hitTarget(target: Enemy | Crate, damage: number): void {
        if ('placement' in target) this.structures?.damageCrate(target, damage);
        else this.hitEnemy(target, damage);
    }

    private hitEnemy(enemy: Enemy, damage: number): void {
        const { x, y } = enemy.sprite;
        if (this.enemySystem.damage(enemy, damage)) {
            this.run.kills++;
            this.onKill(x, y);
            this.onChanged();
        } else {
            enemy.sprite.setAlpha(0.5);
            const timer = this.scene.time.delayedCall(BALANCE.effects.enemyHitDuration, () => {
                this.timers.delete(timer);
                if (enemy.sprite.active) enemy.sprite.setAlpha(1);
            });
            this.timers.add(timer);
        }
    }

    private blockImpact(): void {
        const effect = this.scene.add.container(this.player.x + this.player.facing * 38, this.player.y).setDepth(9).setScrollFactor(1);
        effect.add([
            this.scene.add.rectangle(0, 0, 5, 30, 0xfff6bd),
            this.scene.add.rectangle(0, 0, 30, 5, 0xfff6bd).setAngle(25),
            this.scene.add.rectangle(0, 0, 30, 5, 0xfff6bd).setAngle(-25)
        ]);
        this.slashes.add(effect);
        const tween = this.scene.tweens.add({ targets: effect, alpha: 0, duration: SHIELD.impactMs,
            onComplete: () => { effect.destroy(); this.slashes.delete(effect); this.tweens.delete(tween); } });
        this.tweens.add(tween);
    }

    private takeDamage() {
        if (this.run.phase !== 'playing') return;
        if ((this.run.runTime * 1000) - this.run.lastDamage < BALANCE.player.damageCooldown) return;
        this.run.lastDamage = (this.run.runTime * 1000);
        this.run.health--;
        this.player.showHurt();
        this.onDamage();
        this.scene.cameras.main.shake(BALANCE.effects.shakeDuration, BALANCE.effects.shakeIntensity);
        const tween = this.scene.tweens.add({ targets: this.player.sprite, alpha: 0.35, duration: BALANCE.effects.damageFlashDuration, yoyo: true, repeat: BALANCE.effects.damageFlashRepeats,
            onComplete: () => { this.player.sprite.setAlpha(1); this.tweens.delete(tween); } });
        this.tweens.add(tween);
        if (this.run.health <= 0) this.onDeath();
        this.onChanged();
    }

    destroy(): void {
        this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
        for (const timer of this.timers) timer.remove(false);
        for (const tween of this.tweens) tween.remove();
        for (const slash of this.slashes) if (slash.active) slash.destroy();
        for (const shot of this.projectiles) if (shot.sprite.active) shot.sprite.destroy();
        this.projectiles = [];
        this.timers.clear();
        this.tweens.clear();
        this.slashes.clear();
    }
}
