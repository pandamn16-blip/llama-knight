import { Scenes } from 'phaser';
import type { Scene, GameObjects } from 'phaser';
import { WORLD } from '../config/world';
import { BALANCE } from '../config/balance';
import { generateSection, sectionWindow } from './sections';
import type { WorldSection } from './sections';

// Only nearby sections own Phaser objects. Their flat layout is reproducible on return.
export class WorldSystem {
    private sections = new Map<number, { data: WorldSection; objects: GameObjects.Rectangle[]; scenery: GameObjects.Rectangle[] }>();

    constructor(private scene: Scene, private seed: number, private groundY: number) {
        scene.events.once(Scenes.Events.SHUTDOWN, this.destroy, this);
        this.update();
    }

    update(): void {
        const camera = this.scene.cameras.main;
        const prepare = sectionWindow(camera.scrollX, camera.width, WORLD.preparationViewports);
        const retain = sectionWindow(camera.scrollX, camera.width, WORLD.cleanupViewports);
        for (const [index, section] of this.sections) {
            if (index < retain.first || index > retain.last) {
                section.objects.forEach(object => object.destroy());
                this.sections.delete(index);
            }
        }
        for (let index = prepare.first; index <= prepare.last; index++) {
            if (this.sections.has(index)) continue;
            const data = generateSection(index, this.seed);
            const scenery = data.sceneryXs.map(x => this.scene.add.rectangle(x, this.groundY - 115,
                95, 205, 0x8195a7, 0.48).setDepth(0).setScrollFactor(1));
            const height = this.scene.scale.height;
            const centre = (data.startX + data.endX) / 2;
            const ground = this.scene.add.rectangle(centre, this.groundY + (height - this.groundY) / 2,
                WORLD.sectionLength, height - this.groundY, 0x65865b).setDepth(1).setScrollFactor(1);
            const edge = this.scene.add.rectangle(centre, this.groundY + 5,
                WORLD.sectionLength, 10, 0x425b3c).setDepth(2).setScrollFactor(1);
            this.sections.set(index, { data, objects: [...scenery, ground, edge], scenery });
        }
        for (const section of this.sections.values()) {
            for (const block of section.scenery) {
                const visible = block.x >= camera.scrollX - BALANCE.scenery.spacing &&
                    block.x <= camera.scrollX + camera.width + BALANCE.scenery.spacing;
                if (block.visible !== visible) block.setVisible(visible);
            }
        }
    }

    destroy(): void {
        this.scene.events.off(Scenes.Events.SHUTDOWN, this.destroy, this);
        for (const section of this.sections.values()) section.objects.forEach(object => object.destroy());
        this.sections.clear();
    }
}
