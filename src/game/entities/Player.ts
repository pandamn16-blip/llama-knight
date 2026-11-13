import type { Scene, GameObjects } from 'phaser';
import { BALANCE } from '../config/balance';
import type { RunState, RunPhase } from '../state/RunState';
import { PlayerVisual } from './PlayerVisual';
export { createPlayerVisual } from './PlayerVisual';
import { CHARACTERS } from '../characters/definitions';
import type { PlayerActions } from '../input/PlayerInput';

export class Player {
    readonly sprite: GameObjects.Container;
    private visual: PlayerVisual;
    private facingDirection: -1 | 1 = 1;

    constructor(scene: Scene, private run: RunState, private groundY: number) {
        const { width } = scene.scale;
        this.visual = new PlayerVisual(scene,
            Math.min(BALANCE.player.startX, width * BALANCE.player.startXRatio),
            groundY - BALANCE.player.groundOffset, CHARACTERS[run.characterId].visual);
        this.sprite = this.visual.container;
        this.sprite.setScrollFactor(1, 1, true);
    }

    get facing(): -1 | 1 { return this.facingDirection; }
    get x(): number { return this.sprite.x; }
    get y(): number { return this.sprite.y; }

    showAttack(): boolean {
        return this.visual.showAction('attack') && this.visual.attackIncludesWeaponEffect;
    }
    showHurt(): void { this.visual.showAction('hurt'); }
    showDeath(): void { this.visual.showAction('death'); }
    setVisualPhase(phase: RunPhase): void { this.visual.setPhase(phase); }

    update(actions: Pick<PlayerActions, 'left' | 'right' | 'jump'>, dt: number): void {
        const previousX = this.sprite.x;
        // Opposing/no inputs preserve the last direction, including while airborne.
        if (actions.left !== actions.right) {
            this.facingDirection = actions.left ? -1 : 1;
            this.visual.setFacing(this.facingDirection);
        }
        if (actions.left) this.sprite.x -= this.run.moveSpeed * dt;
        if (actions.right) this.sprite.x += this.run.moveSpeed * dt;
        this.sprite.x = Math.max(BALANCE.player.minX, this.sprite.x);
        if (actions.jump && this.run.onGround) { this.run.velocityY = BALANCE.player.jumpVelocity; this.run.onGround = false; }
        if (!this.run.onGround) { this.run.velocityY += BALANCE.player.gravity * dt; this.sprite.y += this.run.velocityY * dt; }
        if (this.sprite.y >= this.groundY - BALANCE.player.groundOffset) {
            this.sprite.y = this.groundY - BALANCE.player.groundOffset; this.run.velocityY = 0; this.run.onGround = true;
        }
        this.visual.update(this.run, this.sprite.x !== previousX);
    }
}
