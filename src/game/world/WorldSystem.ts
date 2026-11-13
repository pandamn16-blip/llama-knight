import { Scenes } from 'phaser';
import type { Scene, GameObjects } from 'phaser';
import { WORLD } from '../config/world';
import { BALANCE } from '../config/balance';
import { generateSection, sectionWindow } from './sections';
import type { WorldSection } from './sections';
import { landingSurfaceY, standingSurfaceY } from './terrain';
import type { TerrainPlatform } from './terrain';
import { terrainTexture, ENVIRONMENT_ASSETS } from './environmentAssets';

type SectionVisuals = {
    data: WorldSection;
    objects: GameObjects.GameObject[];
    scenery: GameObjects.Rectangle[];
};

// Deterministic geometry is separate from optional terrain textures. The ground
// remains uninterrupted; platforms are forgiving, one-way landing surfaces.
export class WorldSystem {
    private sections = new Map<number, SectionVisuals>();
    private backgrounds: { sprite: GameObjects.TileSprite; factor: number }[] = [];

    constructor(private scene: Scene, private seed: number, private groundY: number) {
        scene.events.once(Scenes.Events.SHUTDOWN, this.destroy, this);
        this.createBackgrounds();
        this.update();
    }

    private createBackgrounds(): void {
        const entries = Object.values(ENVIRONMENT_ASSETS.breadlands.backgrounds);
        for (const entry of entries) {
            if (!terrainTexture(this.scene, entry.key)) continue;
            const { width, height } = this.scene.scale;
            const sprite = this.scene.add.tileSprite(width / 2, height / 2, width, height, entry.key)
                .setScrollFactor(0).setDepth(-10 + this.backgrounds.length);
            this.backgrounds.push({ sprite, factor: entry.scrollFactor });
        }
    }

    private tile(x: number, y: number, width: number, height: number,
        key: string, colour: number, depth: number): GameObjects.GameObject {
        if (terrainTexture(this.scene, key)) {
            return this.scene.add.image(x, y, key).setDisplaySize(width, height).setDepth(depth);
        }
        return this.scene.add.rectangle(x, y, width, height, colour).setDepth(depth);
    }

    private drawPlatform(platform: TerrainPlatform): GameObjects.GameObject[] {
        const tile = WORLD.terrainTileSize;
        const top = this.groundY - platform.height;
        const count = Math.round(platform.width / tile);
        const first = platform.x - platform.width / 2;
        const result: GameObjects.GameObject[] = [];
        // Narrow ledge body; full height is not solid, so players can jump through
        // its underside and land on the top surface.
        for (let i = 0; i < count; i++) {
            const x = first + tile * (i + 0.5);
            const key = i === 0 ? 'breadlands:platform-left' :
                i === count - 1 ? 'breadlands:platform-right' : 'breadlands:platform-middle';
            result.push(this.tile(x, top + 12, tile, 24, key, 0x95734f, 3));
            result.push(this.scene.add.rectangle(x, top + 1.5, tile, 3, 0x86b35b).setDepth(4));
        }
        return result;
    }

    private drawSection(data: WorldSection): SectionVisuals {
        const objects: GameObjects.GameObject[] = [];
        const scenery = data.sceneryXs.map(x => this.scene.add.rectangle(x, this.groundY - 115,
            95, 205, 0x8195a7, 0.48).setDepth(0).setScrollFactor(1));
        objects.push(...scenery);
        const height = this.scene.scale.height;
        const centre = (data.startX + data.endX) / 2;
        objects.push(this.scene.add.rectangle(centre, this.groundY + (height - this.groundY) / 2,
            WORLD.sectionLength, height - this.groundY, 0x65865b).setDepth(1));
        const tile = WORLD.terrainTileSize;
        for (let x = data.startX + tile / 2; x < data.endX; x += tile) {
            objects.push(this.tile(x, this.groundY + tile / 2, tile, tile,
                'breadlands:ground-top', 0x52744a, 2));
            // Ground fill artwork can be introduced without changing the collision.
            if (terrainTexture(this.scene, 'breadlands:ground-fill')) {
                for (let y = this.groundY + tile * 1.5; y < height + tile / 2; y += tile)
                    objects.push(this.tile(x, y, tile, tile, 'breadlands:ground-fill', 0x65865b, 1));
            }
        }
        for (const platform of data.platforms) objects.push(...this.drawPlatform(platform));
        return { data, objects, scenery };
    }

    private platformsNear(x: number): TerrainPlatform[] {
        const index = Math.floor(x / WORLD.sectionLength);
        const result: TerrainPlatform[] = [];
        for (const i of [index - 1, index, index + 1]) {
            if (i < 0) continue;
            const data = this.sections.get(i)?.data ?? generateSection(i, this.seed);
            result.push(...data.platforms);
        }
        return result;
    }

    landingY(x: number, previousFoot: number, nextFoot: number): number | undefined {
        return landingSurfaceY(this.platformsNear(x), this.groundY, x, previousFoot, nextFoot);
    }

    standingY(x: number, currentFoot: number): number | undefined {
        return standingSurfaceY(this.platformsNear(x), this.groundY, x, currentFoot);
    }

    update(): void {
        const camera = this.scene.cameras.main;
        for (const layer of this.backgrounds) layer.sprite.tilePositionX = camera.scrollX * layer.factor;
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
            this.sections.set(index, this.drawSection(generateSection(index, this.seed)));
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
        for (const layer of this.backgrounds) layer.sprite.destroy();
        this.backgrounds = [];
        this.sections.clear();
    }
}
