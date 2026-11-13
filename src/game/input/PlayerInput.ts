import { Input, Scenes } from 'phaser';
import type { Scene, Types } from 'phaser';

export type PlayerActions = { left: boolean; right: boolean; jump: boolean; attack: boolean };

type TouchAction = keyof PlayerActions;

export class PlayerInput {
    private cursors: Types.Input.Keyboard.CursorKeys;
    private keys: Record<'A' | 'D' | 'W' | 'J' | 'R' | 'M' | 'ONE' | 'TWO' | 'THREE', Input.Keyboard.Key>;
    private touches: Record<TouchAction, Set<number>> = {
        left: new Set(), right: new Set(), jump: new Set(), attack: new Set()
    };
    private cleanups: (() => void)[] = [];

    constructor(private scene: Scene, private isPlaying: () => boolean) {
        const { width, height } = scene.scale;
        this.cursors = scene.input.keyboard!.createCursorKeys();
        this.keys = scene.input.keyboard!.addKeys('A,D,W,J,R,M,ONE,TWO,THREE') as typeof this.keys;
        scene.input.keyboard!.addCapture(['SPACE', 'UP', 'DOWN', 'LEFT', 'RIGHT']);

        this.makeTouchButton(66, height - 68, '◀', 'left');
        this.makeTouchButton(154, height - 68, '▶', 'right');
        this.makeTouchButton(width - 174, height - 68, 'JUMP', 'jump');
        this.makeTouchButton(width - 70, height - 68, 'ATK', 'attack');

        const release = (pointer: Input.Pointer) => this.releasePointer(pointer);
        const leaveCanvas = () => this.releasePointer(scene.input.mousePointer);
        const rotate = () => this.clearAll();
        scene.input.on('pointerup', release);
        scene.input.on('pointerupoutside', release);
        scene.input.on('gameout', leaveCanvas);
        window.addEventListener('orientationchange', rotate);
        const orientation = window.screen?.orientation;
        orientation?.addEventListener('change', rotate);
        this.cleanups.push(() => {
            scene.input.off('pointerup', release);
            scene.input.off('pointerupoutside', release);
            scene.input.off('gameout', leaveCanvas);
            window.removeEventListener('orientationchange', rotate);
            orientation?.removeEventListener('change', rotate);
        });
        scene.events.once(Scenes.Events.SHUTDOWN, this.destroy, this);
    }

    readActions(): PlayerActions {
        if (!this.isPlaying()) return { left: false, right: false, jump: false, attack: false };
        const left = this.cursors.left.isDown || this.keys.A.isDown || this.touches.left.size > 0;
        const right = this.cursors.right.isDown || this.keys.D.isDown || this.touches.right.size > 0;
        const jump = this.cursors.up.isDown || this.cursors.space.isDown || this.keys.W.isDown || this.touches.jump.size > 0;
        const attack = this.keys.J.isDown || this.touches.attack.size > 0;
        return { left, right, jump, attack };
    }

    restartPressed(): boolean {
        return Input.Keyboard.JustDown(this.keys.R);
    }

    menuPressed(): boolean {
        return Input.Keyboard.JustDown(this.keys.M);
    }

    upgradeChoice(): number | undefined {
        if (Input.Keyboard.JustDown(this.keys.ONE)) return 0;
        else if (Input.Keyboard.JustDown(this.keys.TWO)) return 1;
        else if (Input.Keyboard.JustDown(this.keys.THREE)) return 2;
        return undefined;
    }

    clearTouch(): void {
        for (const pointers of Object.values(this.touches)) pointers.clear();
    }

    clearAll(): void {
        this.clearTouch();
        this.scene.input.keyboard!.resetKeys();
    }

    private releasePointer(pointer: Input.Pointer): void {
        for (const pointers of Object.values(this.touches)) pointers.delete(pointer.id);
    }

    destroy(): void {
        this.scene.events.off(Scenes.Events.SHUTDOWN, this.destroy, this);
        for (const cleanup of this.cleanups) cleanup();
        this.cleanups = [];
        this.clearAll();
        // Phaser's scene KeyboardPlugin destroys its keys/listeners on shutdown.
    }

    private makeTouchButton(x: number, y: number, label: string,
        action: 'left' | 'right' | 'jump' | 'attack') {
        const button = this.scene.add.circle(x, y, 35, 0x25263f, 0.74).setDepth(30).setScrollFactor(0).setInteractive();
        this.scene.add.text(x, y, label, { fontSize: label.length > 2 ? '13px' : '25px', color: '#ffffff' })
            .setOrigin(0.5).setDepth(31).setScrollFactor(0);
        const press = (pointer: Input.Pointer) => {
            if (this.isPlaying()) this.touches[action].add(pointer.id);
        };
        const release = (pointer: Input.Pointer) => this.touches[action].delete(pointer.id);
        button.on('pointerdown', press);
        button.on('pointerup', release);
        button.on('pointerout', release);
        this.cleanups.push(() => {
            button.off('pointerdown', press);
            button.off('pointerup', release);
            button.off('pointerout', release);
        });
    }

}
