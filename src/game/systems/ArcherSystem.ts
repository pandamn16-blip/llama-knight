import { Scenes } from 'phaser';
import type { Scene, GameObjects } from 'phaser';
import { WORLD } from '../config/world';
import { ARCHER } from '../config/archers';
import { hasPyromancerIdle, PYROMANCER_IDLE } from '../enemies/pyromancer';
import type { RunPhase } from '../state/RunState';
import { generateSection, sectionWindow } from '../world/sections';
import type { RunState } from '../state/RunState';
import type { Player } from '../entities/Player';

export type Archer = {
    kind: 'archer';
    id: string;
    sprite: GameObjects.Container;
    hp: number;
    maxHealth: number;
    state: 'watch' | 'aim' | 'reload';
    timer: number;
    facing: -1 | 1;
    warning: GameObjects.Text;
    art?: GameObjects.Sprite;
};
type ArcherRecord = { hp: number; dead: boolean };
type Arrow = { sprite: GameObjects.Container; vx: number; vy: number; distance: number };

// Archers use their own, stationary elevated AI rather than modifying Bread's
// ground patrol brain. No textures required; their placeholders are replaceable.
export class ArcherSystem {
    private active = new Map<string, Archer>();
    private records = new Map<string, ArcherRecord>();
    private arrows: Arrow[] = [];

    constructor(private scene: Scene, private run: RunState,
        private groundY: number, private player: Pick<Player, 'x' | 'y'>,
        private onArrowHit: (sourceDirection: -1 | 1) => void, private onKilled: (x: number, y: number) => void) {
        scene.events.once(Scenes.Events.SHUTDOWN, this.destroy, this);
    }

    get archers(): readonly Archer[] { return [...this.active.values()]; }

    prepare(): void {
        const camera = this.scene.cameras.main;
        const retain = camera.width * WORLD.cleanupViewports;
        for (const [id, archer] of this.active) {
            if (archer.sprite.x < camera.scrollX - retain || archer.sprite.x > camera.scrollX + camera.width + retain) {
                archer.sprite.destroy(); this.active.delete(id);
            }
        }
        const win = sectionWindow(camera.scrollX, camera.width, WORLD.preparationViewports);
        for (let index = win.first; index <= win.last; index++) {
            // One archer every other section, never on the introductory section.
            if (index === 0 || index % 2 === 0) continue;
            const perch = generateSection(index, this.run.seed).platforms[3];
            const id = `${perch.id}:archer`;
            const record = this.records.get(id) ?? { hp: ARCHER.hp, dead: false };
            if (record.dead || this.active.has(id) ||
                perch.x < camera.scrollX - retain || perch.x > camera.scrollX + camera.width + retain) continue;
            this.records.set(id, record);
            const sprite = this.scene.add.container(perch.x, this.groundY - perch.height - ARCHER.footOffset)
                .setDepth(6).setScrollFactor(1);
            // The approved pancake pyromancer is the Archer's temporary visual skin.
            // Collision, attack timing and projectile behaviour stay unchanged.
            let art: GameObjects.Sprite | undefined;
            if (hasPyromancerIdle(this.scene)) {
                art = this.scene.add.sprite(0, ARCHER.footOffset,
                    PYROMANCER_IDLE.key, PYROMANCER_IDLE.start)
                    .setOrigin(PYROMANCER_IDLE.originX, PYROMANCER_IDLE.originY)
                    .setScale(PYROMANCER_IDLE.scale);
                sprite.add(art);
                art.play(PYROMANCER_IDLE.animationKey);
            } else {
                sprite.add([
                    this.scene.add.ellipse(0, 0, 54, 58, 0xc98d50).setStrokeStyle(3, 0x5e3d27),
                    this.scene.add.rectangle(0, -24, 53, 13, 0x66855b),
                    this.scene.add.circle(-10, -5, 3, 0x33271f),
                    this.scene.add.circle(10, -5, 3, 0x33271f),
                    this.scene.add.rectangle(30, 0, 4, 42, 0x78512d)
                ]);
            }
            const warning = this.scene.add.text(0, -55, '!', {
                fontSize: '26px', color: '#ffe4a0', backgroundColor: '#a54f33'
            }).setOrigin(0.5).setVisible(false);
            sprite.add(warning);
            this.active.set(id, { kind: 'archer', id, sprite, hp: record.hp, maxHealth: ARCHER.hp,
                state: 'watch', timer: 0, facing: -1, warning, art });
        }
    }

    damage(archer: Archer, amount: number): boolean {
        if (this.run.phase !== 'playing' || this.active.get(archer.id) !== archer) return false;
        const record = this.records.get(archer.id)!;
        record.hp = archer.hp = Math.max(0, archer.hp - amount);
        if (archer.hp > 0) return false;
        record.dead = true;
        this.active.delete(archer.id);
        const { x, y } = archer.sprite;
        archer.sprite.destroy();
        this.onKilled(x, y);
        return true;
    }

    private shoot(archer: Archer): void {
        const dx = this.player.x - archer.sprite.x;
        const dy = this.player.y - archer.sprite.y;
        const length = Math.hypot(dx, dy) || 1;
        const vx = dx / length * ARCHER.projectileSpeed;
        const vy = dy / length * ARCHER.projectileSpeed;
        const sprite = this.scene.add.container(archer.sprite.x + archer.facing * 25,
            archer.sprite.y - 8).setDepth(7).setScrollFactor(1);
        sprite.add([
            this.scene.add.rectangle(0, 0, 29, 5, 0x715030).setAngle(Math.atan2(vy, vx) * 180 / Math.PI),
            this.scene.add.rectangle(13, 0, 10, 8, 0xffe0a1).setAngle(Math.atan2(vy, vx) * 180 / Math.PI)
        ]);
        this.arrows.push({ sprite, vx, vy, distance: 0 });
    }

    update(dt: number): void {
        if (this.run.phase !== 'playing') return;
        this.prepare();
        const camera = this.scene.cameras.main;
        for (const archer of this.active.values()) {
            const dx = this.player.x - archer.sprite.x;
            const visible = archer.sprite.x >= camera.scrollX - ARCHER.activationMargin &&
                archer.sprite.x <= camera.scrollX + camera.width + ARCHER.activationMargin;
            archer.sprite.setVisible(visible);
            if (!visible) { archer.art?.anims.pause(); continue; }
            if (this.run.phase === 'playing') archer.art?.anims.resume();
            archer.art?.setFlipX(archer.facing === -1);
            const inRange = Math.abs(dx) < ARCHER.detectionRange &&
                Math.abs(this.player.y - archer.sprite.y) < ARCHER.detectionHeight;
            if (archer.state === 'watch') {
                if (inRange) {
                    archer.state = 'aim'; archer.timer = ARCHER.aimDuration;
                    archer.facing = dx < 0 ? -1 : 1;
                    archer.warning.setVisible(true);
                }
            } else if (archer.state === 'aim') {
                if (!inRange) { archer.state = 'watch'; archer.warning.setVisible(false); }
                else if ((archer.timer -= dt) <= 0) {
                    this.shoot(archer); archer.state = 'reload';
                    archer.timer = ARCHER.reloadDuration; archer.warning.setVisible(false);
                }
            } else if ((archer.timer -= dt) <= 0) archer.state = 'watch';
        }
        for (let i = this.arrows.length - 1; i >= 0; i--) {
            const arrow = this.arrows[i], { sprite } = arrow;
            const fromX = sprite.x, fromY = sprite.y;
            const distance = Math.hypot(arrow.vx, arrow.vy) * dt;
            const toX = fromX + arrow.vx * dt, toY = fromY + arrow.vy * dt;
            // Swept point-to-segment distance avoids fast arrows tunnelling.
            const vx = toX - fromX, vy = toY - fromY;
            const t = Math.max(0, Math.min(1, ((this.player.x - fromX) * vx +
                (this.player.y - fromY) * vy) / (vx * vx + vy * vy || 1)));
            const hit = Math.hypot(fromX + vx * t - this.player.x,
                fromY + vy * t - this.player.y) < ARCHER.arrowHitRadius;
            sprite.x = toX; sprite.y = toY;
            arrow.distance += distance;
            if (hit) this.onArrowHit(arrow.vx >= 0 ? -1 : 1);
            if (hit || arrow.distance >= ARCHER.projectileRange ||
                sprite.x < camera.scrollX - 100 || sprite.x > camera.scrollX + camera.width + 100) {
                sprite.destroy(); this.arrows.splice(i, 1);
            }
            if (this.run.phase !== 'playing') break;
        }
    }

    setPhase(phase: RunPhase): void {
        for (const archer of this.active.values()) {
            if (phase === 'playing') archer.art?.anims.resume();
            else archer.art?.anims.pause();
        }
    }

    destroy(): void {
        this.scene.events.off(Scenes.Events.SHUTDOWN, this.destroy, this);
        for (const archer of this.active.values()) archer.sprite.destroy();
        for (const arrow of this.arrows) arrow.sprite.destroy();
        this.active.clear(); this.records.clear(); this.arrows = [];
    }
}
