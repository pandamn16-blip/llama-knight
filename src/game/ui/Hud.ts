import type { Scene, GameObjects } from 'phaser';
import { CHARACTERS } from '../characters/definitions';
import { WEAPONS } from '../weapons/definitions';
import type { RunState } from '../state/RunState';
import { isMobileLayout } from './layout';

export class Hud {
    private mobile = isMobileLayout();
    private text: GameObjects.Text;

    constructor(scene: Scene) {
        this.text = scene.add.text(18, 15, '', {
            fontSize: this.mobile ? '32px' : '17px', color: '#21372e', fontStyle: 'bold', lineSpacing: 6,
            backgroundColor: this.mobile ? '#f7eedc' : undefined,
            padding: this.mobile ? { x: 16, y: 10 } : undefined
        }).setDepth(20).setScrollFactor(0);
    }

    update(run: Readonly<RunState>, xpNeeded: number) {
        if (this.mobile) {
            this.text.setText([
                `♥ ${run.health}/${run.maxHealth}    LEVEL ${run.level}`,
                `XP ${run.xp}/${xpNeeded}    ${Math.floor(run.distance)}m`,
                `${WEAPONS[run.weapon.id].name}   BREAD ${run.kills}`
            ]);
            // Keep the row below these stats clear for future equipped-item icons.
            return;
        }
        this.text.setText([
            `${CHARACTERS[run.characterId].name}     ♥ ${run.health}/${run.maxHealth}     ${WEAPONS[run.weapon.id].name}`,
            `LEVEL ${run.level}    XP ${run.xp}/${xpNeeded}`,
            `BREAD ${run.kills}    DISTANCE ${Math.floor(run.distance)}m`,
            `J = ATTACK${CHARACTERS[run.characterId].canShield ? '    |    Hold K — Shield' : ''}    |    1 / 2 / 3 = PICK UPGRADE`
        ]);
    }
}
