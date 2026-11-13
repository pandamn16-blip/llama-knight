import { Scene, GameObjects, Input } from 'phaser';

export class MainMenu extends Scene
{
    private keys!: Record<'ENTER' | 'SPACE', Input.Keyboard.Key>;
    background: GameObjects.Image;
    logo: GameObjects.Image;
    title: GameObjects.Text;

    constructor ()
    {
        super('MainMenu');
    }

    create ()
    {
        this.background = this.add.image(512, 384, 'background');

        this.logo = this.add.image(512, 300, 'logo');

        this.title = this.add.text(512, 460, 'Main Menu', {
            fontFamily: 'Arial Black', fontSize: 38, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);

        this.keys = this.input.keyboard!.addKeys('ENTER,SPACE') as typeof this.keys;
        this.add.text(512, 540, 'TAP OR PRESS ENTER TO CHOOSE A HERO', {
            fontSize: '20px', color: '#ffffff', backgroundColor: '#151527', padding: { x: 12, y: 8 }
        }).setOrigin(0.5);

        this.input.once('pointerdown', () => {

            this.scene.start('CharacterSelect');

        });
    }

    update(): void {
        if (Input.Keyboard.JustDown(this.keys.ENTER) || Input.Keyboard.JustDown(this.keys.SPACE)) {
            this.scene.start('CharacterSelect');
        }
    }
}
