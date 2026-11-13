import { Scenes } from 'phaser';
import type { Scene, GameObjects, Time } from 'phaser';
import { WORLD } from '../config/world';
import { getRosieLine } from '../dialogue/rosieDialogue';
import type { RunState } from '../state/RunState';
import type { RosieEvent } from '../dialogue/rosieDialogue';

export class Rosie {
    private panel: GameObjects.Container;
    private speech: GameObjects.Text;
    private tauntTimer: Time.TimerEvent;
    private hideTimer?: Time.TimerEvent;

    constructor(private scene: Scene, private run: RunState) {
        this.panel = scene.add.container(scene.scale.width - 300, 18).setDepth(25);
        const portrait = scene.add.rectangle(28, 28, 54, 54, 0x5a5268).setStrokeStyle(2, 0xd0c6d6);
        const face = scene.add.text(28, 28, '👸', { fontSize: '32px' }).setOrigin(0.5);
        this.speech = scene.add.text(68, 0, getRosieLine({ event: 'start', characterId: run.characterId }), {
            fontSize: '14px', color: '#45293d', backgroundColor: '#fff3de',
            padding: { x: 8, y: 6 }, wordWrap: { width: 200 }, align: 'left'
        });
        this.panel.add([portrait, face, this.speech]);
        this.panel.setScrollFactor(0, 0, true);
        this.tauntTimer = scene.time.addEvent({ delay: WORLD.rosieDialogueInterval, loop: true, callback: () => {
            if (run.phase === 'playing') this.speak('taunt');
        }});
        this.showBriefly();
        scene.events.once(Scenes.Events.SHUTDOWN, () => {
            this.tauntTimer.remove(false);
            this.hideTimer?.remove(false);
        });
    }

    speak(event: RosieEvent): string {
        const line = getRosieLine({ event, characterId: this.run.characterId });
        this.speech.setText(line);
        if (event !== 'taunt') this.tauntTimer.elapsed = 0;
        this.showBriefly();
        return line;
    }

    private showBriefly(): void {
        this.panel.setVisible(true);
        this.hideTimer?.remove(false);
        this.hideTimer = this.scene.time.delayedCall(WORLD.rosieLineDuration, () => this.panel.setVisible(false));
    }
}
