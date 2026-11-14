import type { Scene, GameObjects } from 'phaser';
import { CHARACTER_SHIELDS, hasShieldSheet } from '../characters/shield';
import type { CharacterVisual } from '../characters/definitions';
import { CHARACTER_SPRITES, hasCharacterSheet, hasCandyLevelUp, resolveCharacterAnimation } from '../characters/spriteAnimations';
import type { PlayerAnimation, CharacterSpriteSheet } from '../characters/spriteAnimations';
import type { RunState, RunPhase } from '../state/RunState';

// Rendering is selected from data; movement below is shared by both characters.
function createPlaceholderVisual(scene: Scene, x: number, y: number, visual: CharacterVisual): GameObjects.Container {
    const sprite = scene.add.container(x, y).setDepth(6);
    if (visual === 'candy') {
        sprite.add([
            scene.add.ellipse(0, 5, 58, 62, 0xef73b6),
            scene.add.circle(0, -28, 23, 0xffdfca),
            scene.add.ellipse(0, -44, 53, 23, 0x6d3b91),
            scene.add.circle(-26, -32, 13, 0xa55bc4),
            scene.add.circle(26, -32, 13, 0xa55bc4),
            scene.add.circle(-8, -28, 3, 0x30213a),
            scene.add.circle(8, -28, 3, 0x30213a),
            scene.add.rectangle(-14, 35, 15, 12, 0x6d3b91),
            scene.add.rectangle(14, 35, 15, 12, 0x6d3b91),
            scene.add.rectangle(29, 0, 7, 32, 0xffffff),
            scene.add.circle(29, -20, 13, 0x84e9ef)
        ]);
        return sprite;
    }
    sprite.add([
        scene.add.ellipse(-14, -49, 13, 31, 0xe8c98f),
        scene.add.ellipse(13, -49, 13, 31, 0xe8c98f),
        scene.add.ellipse(0, 0, 65, 75, 0xe8c98f),
        scene.add.circle(0, -23, 24, 0xf1d9ae),
        scene.add.ellipse(0, -20, 20, 16, 0x9d704f),
        scene.add.circle(-24, 12, 19, 0x76513c),
        scene.add.circle(-24, 12, 6, 0xc1c1c1)
    ]);
    return sprite;
}

function buildVisual(scene: Scene, x: number, y: number, visual: CharacterVisual) {
    const sheet = CHARACTER_SPRITES[visual];
    if (!sheet || !hasCharacterSheet(scene, sheet)) {
        return { container: createPlaceholderVisual(scene, x, y, visual) };
    }
    const idle = resolveCharacterAnimation(scene, sheet, 'idle')!;
    const container = scene.add.container(x, y).setDepth(6);
    const animated = scene.add.sprite(sheet.offsetX, sheet.offsetY, idle.source.key, idle.clip.start)
        .setOrigin(sheet.originX, sheet.originY).setScale(sheet.scale);
    container.add(animated);
    return { container, animated, sheet };
}

// Selection previews use the same visual/anchor with a static idle frame.
export function createPlayerVisual(scene: Scene, x: number, y: number, visual: CharacterVisual): GameObjects.Container {
    return buildVisual(scene, x, y, visual).container;
}

export class PlayerVisual {
    readonly container: GameObjects.Container;
    private shield?: GameObjects.Sprite;
    private defending = false;
    private animated?: GameObjects.Sprite;
    private sheet?: CharacterSpriteSheet;
    private state?: PlayerAnimation;
    private action?: 'attack' | 'hurt' | 'death' | 'levelup';
    private placeholderParts: { object: GameObjects.Shape; x: number; scaleX: number }[] = [];

    constructor(private scene: Scene, x: number, y: number, visual: CharacterVisual) {
        const result = buildVisual(scene, x, y, visual);
        this.container = result.container;
        this.animated = result.animated;
        this.sheet = result.sheet;
        if (!this.animated) this.placeholderParts = this.container.list.map(child => {
            const object = child as GameObjects.Shape;
            return { object, x: object.x, scaleX: object.scaleX };
        });
        const shield = CHARACTER_SHIELDS[visual];
        if (shield && hasShieldSheet(scene, visual)) {
            this.shield = scene.add.sprite(shield.offsetX, shield.offsetY, shield.key, 0)
                .setOrigin(shield.originX, shield.originY).setScale(shield.scale).setVisible(false);
            this.container.add(this.shield);
        }
        this.play('idle');
    }

    setDefending(held: boolean): void {
        if (held && (this.action === 'death' || (this.action === 'hurt' && this.animated?.anims.isPlaying))) return;
        if (this.defending === held) return;
        this.defending = held;
        this.shield?.setVisible(held);
        this.animated?.setVisible(!held || !this.shield);
        for (const part of this.placeholderParts) part.object.setVisible(!held || !this.shield);
        if (held) {
            this.action = undefined;
            if (this.shield) { this.shield.play(this.shield.texture.key, true); this.animated?.anims.pause(); }
        } else {
            this.shield?.anims.pause(); this.animated?.anims.resume(); this.state = undefined;
        }
    }

    setFacing(direction: -1 | 1): void {
        this.shield?.setFlipX(direction === -1);
        if (this.animated) {
            // Phaser mirrors the frame in place. Its origin, offsets and foot pivot stay fixed.
            this.animated.setFlipX(direction === -1);
        } else {
            // Candy and missing-sheet fallbacks are shapes, which have no Flip component.
            // Mirror only those visual children around their original local coordinates.
            for (const part of this.placeholderParts) {
                part.object.x = part.x * direction;
                part.object.scaleX = part.scaleX * direction;
            }
        }
    }

    update(run: RunState, moving: boolean): void {
        if (!this.animated || this.action === 'death' || (this.defending && this.shield)) return;
        if (this.action && this.animated.anims.isPlaying) return;
        this.action = undefined;
        const state = !run.onGround ? (run.velocityY < 0 ? 'jump' : 'fall') : moving ? 'run' : 'idle';
        this.play(state);
    }

    showAction(action: 'attack' | 'hurt' | 'death'): boolean {
        if (!this.animated || this.action === 'death') return false;
        if (action === 'attack' && this.action === 'hurt' && this.animated.anims.isPlaying) return false;
        this.setDefending(false);
        this.action = action;
        return this.play(action, true);
    }

    showLevelUp(): void {
        if (!this.animated || this.sheet?.key !== 'candy' ||
            !hasCandyLevelUp(this.scene) || this.action === 'death') return;
        this.setDefending(false);
        this.action = 'levelup';
        this.state = undefined;
        this.animated.play('candy:levelup', true);
    }

    get attackIncludesWeaponEffect(): boolean {
        return !!this.animated && !!this.sheet &&
            resolveCharacterAnimation(this.scene, this.sheet, 'attack')?.clip.includesWeaponEffect === true;
    }

    setPhase(phase: RunPhase): void {
        const frozen = phase === 'paused' || phase === 'choosingUpgrade';
        if (frozen) { this.animated?.anims.pause(); this.shield?.anims.pause(); }
        else {
            if (!this.defending || !this.shield) this.animated?.anims.resume();
            if (this.defending) this.shield?.anims.resume();
        }
    }

    private play(state: PlayerAnimation, restart = false): boolean {
        if (!this.animated || !this.sheet) return false;
        const key = `${this.sheet.key}:${state}`;
        if (!this.scene.anims.exists(key)) return false;
        if (restart || this.state !== state) {
            this.animated.play(key, !restart);
            this.state = state;
        }
        return true;
    }
}
