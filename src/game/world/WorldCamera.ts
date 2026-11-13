import type { Cameras } from 'phaser';
import { WORLD } from '../config/world';

export class WorldCamera {
    private worldWidth = WORLD.sectionLength * 2;

    constructor(private camera: Cameras.Scene2D.Camera, private height: number) {
        camera.setBounds(0, 0, this.worldWidth, height);
        camera.setScroll(0, 0);
    }

    update(playerX: number, dt: number): void {
        // Grow bounds well ahead of the target; never reset scroll when extending.
        const required = Math.ceil((Math.max(playerX, this.camera.scrollX) +
            this.camera.width * (2 + WORLD.preparationViewports)) / WORLD.sectionLength) * WORLD.sectionLength;
        if (required > this.worldWidth) {
            this.worldWidth = required;
            this.camera.setBounds(0, 0, this.worldWidth, this.height);
        }
        // Facing must not move the camera target when the player merely turns.
        const ratio = WORLD.rightFollowRatio;
        const target = Math.max(0, playerX - this.camera.width * ratio);
        const next = this.camera.scrollX + (target - this.camera.scrollX) * (1 - Math.exp(-WORLD.cameraSharpness * dt));
        // No vertical following: jumping never moves the horizon or ground.
        this.camera.setScroll(Math.abs(next - target) < 0.01 ? target : next, 0);
    }
}
