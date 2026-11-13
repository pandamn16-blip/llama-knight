import type { Scene } from 'phaser';
import type { Upgrade } from '../data/upgrades';
import { isMobileLayout, onLayoutResize } from './layout';

// Rendering only: the scene owns offers, keyboard input, validation and effects.
export function createUpgradePanel(
    scene: Scene, level: number, options: readonly Upgrade[], onChoose: (index: number) => void, rosieLine?: string
) {
    const panel = scene.add.container(0, 0).setDepth(100).setScrollFactor(0);
    const draw = () => {
        panel.removeAll(true);
        const { width, height } = scene.scale;
        const mobile = isMobileLayout();
        panel.add(scene.add.rectangle(width / 2, height / 2, width, height, 0x151527, 0.91));
        panel.add(scene.add.text(width / 2, mobile ? 116 : height * 0.20, `LEVEL ${level}!`, {
            fontSize: mobile ? '44px' : '36px', fontStyle: 'bold', color: '#ffe0a2'
        }).setOrigin(0.5));
        panel.add(scene.add.text(width / 2, mobile ? 178 : height * 0.29, 'CHOOSE ONE UPGRADE', {
            fontSize: mobile ? '30px' : '19px', color: '#ffffff'
        }).setOrigin(0.5));
        const cardWidth = Math.min(width * (mobile ? 0.78 : 0.83), mobile ? 1100 : 570);
        options.forEach((option, index) => {
            const y = mobile ? 300 + index * 140 : height * (0.43 + index * 0.17);
            const rect = scene.add.rectangle(width / 2, y, cardWidth, mobile ? 118 : Math.min(82, height * 0.14), 0x45405f)
                // Phaser 4 hit testing requires the child's own scroll factor.
                .setScrollFactor(0).setStrokeStyle(2, 0xbab0e1).setInteractive({ useHandCursor: true });
            rect.on('pointerdown', () => onChoose(index));
            panel.add(rect);
            panel.add(scene.add.text(width / 2, y - (mobile ? 23 : 15), `${mobile ? '' : `${index + 1}. `}${option.title}`, {
                fontSize: mobile ? '34px' : '19px', color: '#fff0be', fontStyle: 'bold'
            }).setOrigin(0.5));
            panel.add(scene.add.text(width / 2, y + (mobile ? 24 : 16), option.description, {
                fontSize: mobile ? '27px' : '15px', color: '#ffffff'
            }).setOrigin(0.5));
        });
        if (rosieLine) panel.add(scene.add.text(width / 2, mobile ? 44 : height * 0.09, `Rosie: ${rosieLine}`, {
            fontSize: mobile ? '26px' : '17px', color: '#fff0be', align: 'center', wordWrap: { width: width * (mobile ? 0.86 : 0.8) }
        }).setOrigin(0.5));
    };
    draw();
    panel.once('destroy', onLayoutResize(scene, draw));
    return panel;
}
