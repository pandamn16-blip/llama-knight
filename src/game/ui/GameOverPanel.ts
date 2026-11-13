import type { Scene } from 'phaser';
import type { RunState } from '../state/RunState';
import { isMobileLayout, onLayoutResize } from './layout';

type RunResult = Pick<RunState, 'level' | 'kills' | 'distance'>;

export function createGameOverPanel(scene: Scene, result: Readonly<RunResult>, onRestart: () => void, onMainMenu: () => void, rosieLine: string) {
    const panel = scene.add.container(0, 0).setDepth(110).setScrollFactor(0);
    const draw = () => {
        panel.removeAll(true);
        const { width, height } = scene.scale;
        const mobile = isMobileLayout();
        panel.add(scene.add.rectangle(width / 2, height / 2, width, height, 0x151424, 0.89).setDepth(110).setScrollFactor(0));
        panel.add(scene.add.text(width / 2, height * 0.33, 'THE BREAD HAS WON.', {
            fontSize: mobile ? '44px' : '35px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(111).setScrollFactor(0));
        panel.add(scene.add.text(width / 2, height * 0.49,
            `Level ${result.level}     Bread: ${result.kills}     Distance: ${Math.floor(result.distance)}m`, {
                fontSize: mobile ? '28px' : '20px', color: '#f8d99b'
            }).setOrigin(0.5).setDepth(111).setScrollFactor(0));
        const button = scene.add.text(width / 2, (mobile ? height * 0.63 : height * 0.65), mobile ? 'RESTART' : 'TAP HERE OR PRESS R TO RESTART', {
            fontSize: mobile ? '34px' : '19px', color: '#ffffff', backgroundColor: '#79507c', padding: { x: mobile ? 24 : 18, y: mobile ? 34 : 14 }
        }).setOrigin(0.5).setDepth(111).setScrollFactor(0).setInteractive({ useHandCursor: true });
        panel.add(button);
        button.on('pointerdown', onRestart);
        panel.add(scene.add.text(width / 2, height * 0.18, `Rosie: ${rosieLine}`, {
            fontSize: mobile ? '28px' : '20px', color: '#fff0be', align: 'center', wordWrap: { width: width * 0.8 }
        }).setOrigin(0.5).setDepth(111).setScrollFactor(0));
        panel.add(scene.add.text(width / 2, (mobile ? height * 0.82 : height * 0.79), mobile ? 'MAIN MENU' : 'MAIN MENU  [M]', {
            fontSize: mobile ? '34px' : '19px', color: '#ffffff', backgroundColor: '#79507c', padding: { x: mobile ? 24 : 18, y: mobile ? 34 : 14 }
        }).setOrigin(0.5).setDepth(111).setScrollFactor(0).setInteractive({ useHandCursor: true }).on('pointerdown', onMainMenu));
    };
    draw();
    panel.once('destroy', onLayoutResize(scene, draw));
    return panel;
}
