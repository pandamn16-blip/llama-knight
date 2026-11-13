import type { Scene, GameObjects, Cameras } from 'phaser';
import type { Player } from '../entities/Player';
import type { Enemy } from '../systems/EnemySystem';

// Temporary diagnostics. Speed uses raw browser time, not Phaser's (possibly smoothed) scene delta.
export class WorldDebug {
    private text: GameObjects.Text;
    private elapsed = 200;
    private previousX?: number;
    private previousScroll?: number;
    private travelled = 0;
    private cameraTravelled = 0;
    private simulatedMs = 0;

    constructor(private scene: Scene) {
        this.text = scene.add.text(18, 118, '', {
            fontFamily: 'monospace', fontSize: '13px', color: '#ffffff',
            backgroundColor: '#151527', padding: { x: 8, y: 6 }
        }).setDepth(40).setScrollFactor(0);
    }

    resetSample(player: Player, camera: Cameras.Scene2D.Camera): void {
        this.previousX = player.x;
        this.previousScroll = camera.scrollX;
        this.elapsed = this.travelled = this.cameraTravelled = this.simulatedMs = 0;
    }

    update(player: Player, camera: Cameras.Scene2D.Camera, enemies: readonly Enemy[], deltaMs: number,
        simulatedMs: number = deltaMs, configuredSpeed = 0): void {
        const rawMs = this.scene.game.loop?.rawDelta ?? deltaMs;
        this.elapsed += rawMs;
        if (this.previousX !== undefined) this.travelled += Math.abs(player.x - this.previousX);
        if (this.previousScroll !== undefined) this.cameraTravelled += Math.abs(camera.scrollX - this.previousScroll);
        this.previousX = player.x;
        this.previousScroll = camera.scrollX;
        this.simulatedMs += simulatedMs;
        if (this.elapsed < 200) return;
        let nearest: Enemy | undefined;
        for (const enemy of enemies) {
            if (!nearest || Math.abs(enemy.sprite.x - player.x) < Math.abs(nearest.sprite.x - player.x)) nearest = enemy;
        }
        const fps = this.scene.game.loop?.actualFps ?? (rawMs > 0 ? 1000 / rawMs : 0);
        const seconds = Math.max(this.elapsed / 1000, 0.001);
        this.text.setText([
            `Player world X:  ${player.x.toFixed(1)}`,
            `Camera scroll X: ${camera.scrollX.toFixed(1)}`,
            `Player screen X: ${(player.x - camera.scrollX).toFixed(1)}`,
            `Enemy world X:   ${nearest ? nearest.sprite.x.toFixed(1) : 'none'}`,
            `World speed: ${(this.travelled / seconds).toFixed(1)} / ${configuredSpeed.toFixed(0)} units/s`,
            `Camera speed: ${(this.cameraTravelled / seconds).toFixed(1)} units/s`,
            `Sim / real time: ${(this.simulatedMs / Math.max(this.elapsed, 1)).toFixed(2)}x`,
            `Scene/raw: ${deltaMs.toFixed(1)}/${rawMs.toFixed(1)} ms | FPS: ${fps.toFixed(0)}`,
            `Enemies: ${enemies.length} prepared, ${enemies.filter(enemy => enemy.sprite.visible).length} visible`
        ]);
        this.elapsed = this.travelled = this.cameraTravelled = this.simulatedMs = 0;
    }
}
