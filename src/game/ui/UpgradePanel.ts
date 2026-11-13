import type { Scene } from 'phaser';
import type { Upgrade } from '../data/upgrades';

// Rendering only: the scene owns offers, keyboard input, validation and effects.
export function createUpgradePanel(
    scene: Scene, level: number, options: readonly Upgrade[], onChoose: (index: number) => void, rosieLine?: string
) {
    const { width, height } = scene.scale;
    const panel = scene.add.container(0, 0).setDepth(100);
    panel.add(scene.add.rectangle(width / 2, height / 2, width, height, 0x151527, 0.91));
    panel.add(scene.add.text(width / 2, height * 0.20, `LEVEL ${level}!`, {
        fontSize: '36px', fontStyle: 'bold', color: '#ffe0a2'
    }).setOrigin(0.5));
    panel.add(scene.add.text(width / 2, height * 0.29, 'CHOOSE ONE UPGRADE', {
        fontSize: '19px', color: '#ffffff'
    }).setOrigin(0.5));
    const cardWidth = Math.min(width * 0.83, 570);
    options.forEach((option, index) => {
        const y = height * (0.43 + index * 0.17);
        const rect = scene.add.rectangle(width / 2, y, cardWidth, Math.min(82, height * 0.14), 0x45405f)
            // Input hit testing uses the child's own scroll factor, not its container's.
            .setScrollFactor(0).setStrokeStyle(2, 0xbab0e1).setInteractive({ useHandCursor: true });
        rect.on('pointerdown', () => onChoose(index));
        panel.add(rect);
        panel.add(scene.add.text(width / 2, y - 15, `${index + 1}. ${option.title}`, {
            fontSize: '19px', color: '#fff0be', fontStyle: 'bold'
        }).setOrigin(0.5));
        panel.add(scene.add.text(width / 2, y + 16, option.description, {
            fontSize: '15px', color: '#ffffff'
        }).setOrigin(0.5));
    });
    if (rosieLine) panel.add(scene.add.text(width / 2, height * 0.09, `Rosie: ${rosieLine}`, {
        fontSize: '17px', color: '#fff0be', align: 'center', wordWrap: { width: width * 0.8 }
    }).setOrigin(0.5));
    panel.setScrollFactor(0, 0, true);
    return panel;
}
