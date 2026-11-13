import type { Scene, GameObjects } from 'phaser';
import { CHARACTERS } from '../characters/definitions';
import { WEAPONS } from '../weapons/definitions';
import type { RunState } from '../state/RunState';

export class Hud {
    private text: GameObjects.Text;

    constructor(scene: Scene) {
        this.text = scene.add.text(18, 15, '', {
            fontSize: '17px', color: '#21372e', fontStyle: 'bold', lineSpacing: 6
        }).setDepth(20).setScrollFactor(0);
    }

    update(run: Readonly<RunState>, xpNeeded: number) {
        this.text.setText([
            `${CHARACTERS[run.characterId].name}     ♥ ${run.health}/${run.maxHealth}     ${WEAPONS[run.weapon.id].name}`,
            `LEVEL ${run.level}    XP ${run.xp}/${xpNeeded}`,
            `BREAD ${run.kills}    DISTANCE ${Math.floor(run.distance)}m`,
            `J = ATTACK    |    1 / 2 / 3 = PICK UPGRADE`
        ]);
    }
}
