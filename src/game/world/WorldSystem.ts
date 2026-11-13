import { Scenes } from 'phaser';
import type { Scene, GameObjects } from 'phaser';
import { WORLD } from '../config/world';
import { BALANCE } from '../config/balance';
import { generateSection, sectionWindow } from './sections';
import type { WorldSection } from './sections';
import { landingSurfaceY, standingSurfaceY } from './terrain';
import type { TerrainPlatform } from './terrain';
import type { Landmark } from './landmarks';
import { terrainTexture, ENVIRONMENT_ASSETS } from './environmentAssets';

type SectionVisuals = {
    data: WorldSection;
    objects: GameObjects.GameObject[];
    scenery: GameObjects.Ellipse[];
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
        // Until tile artwork is supplied, draw each ledge as two large shapes,
        // not dozens of individual rectangles. Keeps streaming cost low.
        if (!['breadlands:platform-left', 'breadlands:platform-middle', 'breadlands:platform-right']
            .some(key => terrainTexture(this.scene, key))) {
            return [
                this.scene.add.rectangle(platform.x, top + 12, platform.width, 24, 0x95734f).setDepth(3),
                this.scene.add.rectangle(platform.x, top + 1.5, platform.width, 3, 0x86b35b).setDepth(4)
            ];
        }
        // Narrow ledge body; full height is not solid, so players can jump through
        // its underside and land on the top surface.
        for (let i = 0; i < count; i++) {
            const x = first + tile * (i + 0.5);
            const key = i === 0 ? 'breadlands:platform-left' :
                i === count - 1 ? 'breadlands:platform-right' : 'breadlands:platform-middle';
            // Full-size art tiles are never squashed to placeholder ledge height.
            result.push(terrainTexture(this.scene, key) ?
                this.tile(x, top + tile / 2, tile, tile, key, 0x95734f, 3) :
                this.tile(x, top + 12, tile, 24, key, 0x95734f, 3));
            result.push(this.scene.add.rectangle(x, top + 1.5, tile, 3, 0x86b35b).setDepth(4));
        }
        return result;
    }

    // Landmarks create visual rhythm without changing combat collision. Later
    // artwork can replace each composition through the environment manifest.
    private drawLandmark(landmark: Landmark): GameObjects.GameObject[] {
        const x = landmark.x, y = this.groundY, scale = landmark.scale;
        const key = `breadlands:${landmark.kind}`;
        const sizes: Record<Landmark['kind'], [number, number]> = {
            arch: [160, 172], watchtower: [110, 226], ruins: [172, 112],
            fence: [190, 70], boulders: [145, 80], sign: [70, 100]
        };
        if (terrainTexture(this.scene, key)) {
            const [width, height] = sizes[landmark.kind];
            return [this.scene.add.image(x, y, key).setOrigin(0.5, 1)
                .setDisplaySize(width * scale, height * scale).setFlipX(landmark.flip).setDepth(0)];
        }
        const result: GameObjects.GameObject[] = [];
        const rect = (dx: number, dy: number, w: number, h: number, colour: number) => {
            result.push(this.scene.add.rectangle(x + dx * scale, y + dy * scale,
                w * scale, h * scale, colour).setDepth(0));
        };
        const oval = (dx: number, dy: number, w: number, h: number, colour: number) => {
            result.push(this.scene.add.ellipse(x + dx * scale, y + dy * scale,
                w * scale, h * scale, colour).setDepth(0));
        };
        switch (landmark.kind) {
            case 'arch':
                rect(-56, -72, 24, 144, 0x827e73); rect(56, -72, 24, 144, 0x827e73);
                rect(0, -148, 144, 20, 0xaaa190);
                rect(0, -158, 165, 10, 0x6c8771);
                break;
            case 'watchtower':
                rect(-36, -94, 16, 188, 0x75634c); rect(36, -94, 16, 188, 0x75634c);
                rect(0, -172, 118, 18, 0x986e48);
                rect(0, -205, 98, 12, 0x6c8771);
                rect(-48, -190, 12, 36, 0x6d4d30); rect(48, -190, 12, 36, 0x6d4d30);
                break;
            case 'ruins':
                rect(-60, -42, 36, 84, 0x918f83);
                rect(60, -55, 34, 110, 0xaaa697);
                rect(-25, -90, 120, 16, 0xa5a195);
                rect(33, -17, 86, 32, 0x7e8b71);
                break;
            case 'fence':
                rect(0, -28, 190, 10, 0xa57d54);
                rect(0, -55, 190, 8, 0xc4a074);
                for (const dx of [-78, -26, 26, 78]) rect(dx, -38, 13, 76, 0x78583b);
                break;
            case 'boulders':
                oval(-38, -25, 78, 52, 0x81877f);
                oval(30, -34, 94, 66, 0xa2a59a);
                oval(6, -8, 55, 26, 0x697b68);
                break;
            case 'sign':
                rect(0, -44, 11, 88, 0x7c5334);
                rect(8, -77, 75, 33, 0xc99d64);
                rect(11, -77, 55, 5, 0x765135);
                break;
        }
        return result;
    }

    private drawSection(data: WorldSection): SectionVisuals {
        const objects: GameObjects.GameObject[] = [];
        // Irregular soft distant hills replace the former repeating rectangle
        // columns. These are scenery only: no terrain collisions.
        const scenery = data.sceneryXs.map(x => {
            const variation = (Math.imul(Math.floor(x / BALANCE.scenery.spacing) + 1, 1103515245)
                ^ data.seed) >>> 0;
            const width = 170 + (variation % 120);
            const height = 110 + ((variation >>> 8) % 100);
            const colour = variation & 1 ? 0x8fa6a2 : 0x9ab1a3;
            return this.scene.add.ellipse(x, this.groundY - height / 2 + 10,
                width, height, colour, 0.3).setDepth(0).setScrollFactor(1);
        });
        objects.push(...scenery);
        const height = this.scene.scale.height;
        const centre = (data.startX + data.endX) / 2;
        objects.push(this.scene.add.rectangle(centre, this.groundY + (height - this.groundY) / 2,
            WORLD.sectionLength, height - this.groundY, 0x65865b).setDepth(1));
        const tile = WORLD.terrainTileSize;
        // Keep placeholder rendering lightweight: one strip per section, not 40
        // separate rectangles. Actual authored tiles are only created when enabled.
        if (!terrainTexture(this.scene, 'breadlands:ground-top')) {
            objects.push(this.scene.add.rectangle(centre, this.groundY + 5,
                WORLD.sectionLength, 10, 0x425b3c).setDepth(2));
        } else {
            for (let x = data.startX + tile / 2; x < data.endX; x += tile) {
                objects.push(this.tile(x, this.groundY + tile / 2, tile, tile,
                    'breadlands:ground-top', 0x52744a, 2));
            }
        }
        if (terrainTexture(this.scene, 'breadlands:ground-fill')) {
            for (let x = data.startX + tile / 2; x < data.endX; x += tile)
                for (let y = this.groundY + tile * 1.5; y < height + tile / 2; y += tile)
                    objects.push(this.tile(x, y, tile, tile, 'breadlands:ground-fill', 0x65865b, 1));
        }
        for (const platform of data.platforms) objects.push(...this.drawPlatform(platform));
        for (const landmark of data.landmarks) objects.push(...this.drawLandmark(landmark));
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
