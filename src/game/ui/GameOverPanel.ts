import type { Scene } from 'phaser';
import type { RunState } from '../state/RunState';

type RunResult = Pick<RunState, 'level' | 'kills' | 'distance'>;

export function createGameOverPanel(scene: Scene, result: Readonly<RunResult>, onRestart: () => void, onMainMenu: () => void, rosieLine: string) {
    const { width, height } = scene.scale;
    scene.add.rectangle(width / 2, height / 2, width, height, 0x151424, 0.89).setDepth(110).setScrollFactor(0);
    scene.add.text(width / 2, height * 0.33, 'THE BREAD HAS WON.', {
        fontSize: '35px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(111).setScrollFactor(0);
    scene.add.text(width / 2, height * 0.49,
        `Level ${result.level}     Bread: ${result.kills}     Distance: ${Math.floor(result.distance)}m`, {
            fontSize: '20px', color: '#f8d99b'
        }).setOrigin(0.5).setDepth(111).setScrollFactor(0);
    const button = scene.add.text(width / 2, height * 0.65, 'TAP HERE OR PRESS R TO RESTART', {
        fontSize: '19px', color: '#ffffff', backgroundColor: '#79507c', padding: { x: 18, y: 14 }
    }).setOrigin(0.5).setDepth(111).setScrollFactor(0).setInteractive({ useHandCursor: true });
    button.on('pointerdown', onRestart);
    scene.add.text(width / 2, height * 0.18, `Rosie: ${rosieLine}`, {
        fontSize: '20px', color: '#fff0be', align: 'center', wordWrap: { width: width * 0.8 }
    }).setOrigin(0.5).setDepth(111).setScrollFactor(0);
    scene.add.text(width / 2, height * 0.79, 'MAIN MENU  [M]', {
        fontSize: '19px', color: '#ffffff', backgroundColor: '#79507c', padding: { x: 18, y: 14 }
    }).setOrigin(0.5).setDepth(111).setScrollFactor(0).setInteractive({ useHandCursor: true }).on('pointerdown', onMainMenu);
}
