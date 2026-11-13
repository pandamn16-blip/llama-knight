import { Scenes } from 'phaser';
import type { Scene, GameObjects, Time } from 'phaser';
import { STRUCTURES } from '../config/structures';
import { isMobileLayout, onLayoutResize } from './layout';

export class RewardNotice {
    private text: GameObjects.Text;
    private timer?: Time.TimerEvent;

    constructor(private scene: Scene) {
        this.text = scene.add.text(scene.scale.width / 2, 190, '', {
            fontSize: isMobileLayout() ? '30px' : '22px', color: '#fff0be', backgroundColor: '#453951',
            padding: { x: 18, y: 10 }
        }).setOrigin(0.5).setDepth(90).setScrollFactor(0).setVisible(false);
        onLayoutResize(scene, () => this.text.x = scene.scale.width / 2);
        scene.events.once(Scenes.Events.SHUTDOWN, () => { this.timer?.remove(false); this.text.destroy(); });
    }

    show(message: string): void {
        this.timer?.remove(false);
        this.text.setText(message).setVisible(true);
        this.timer = this.scene.time.delayedCall(STRUCTURES.chest.noticeMs, () => this.text.setVisible(false));
    }
}
