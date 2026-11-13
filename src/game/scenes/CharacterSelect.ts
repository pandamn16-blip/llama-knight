import { Scene, Input, GameObjects } from 'phaser';
import { CHARACTERS } from '../characters/definitions';
import { WEAPONS } from '../weapons/definitions';
import { createPlayerVisual } from '../entities/Player';

export class CharacterSelect extends Scene {
    private choices = Object.values(CHARACTERS);
    private selected = 0;
    private starting = false;
    private cards: GameObjects.Rectangle[] = [];
    private keys!: Record<'LEFT' | 'RIGHT' | 'A' | 'D' | 'ONE' | 'TWO' | 'ENTER' | 'SPACE' | 'ESC', Input.Keyboard.Key>;

    constructor() { super('CharacterSelect'); }

    create(): void {
        this.selected = 0;
        this.starting = false;
        this.cards = [];
        this.cameras.main.setBackgroundColor('#151527');
        this.add.text(512, 76, 'CHOOSE YOUR HERO', {
            fontFamily: 'Arial Black', fontSize: '38px', color: '#ffe0a2'
        }).setOrigin(0.5);
        this.choices.forEach((character, index) => {
            const x = 280 + index * 464;
            const card = this.add.rectangle(x, 370, 420, 440, 0x45405f)
                .setInteractive({ useHandCursor: true });
            card.on('pointerdown', () => this.startRun(index));
            this.cards.push(card);
            createPlayerVisual(this, x, 265, character.visual);
            this.add.text(x, 344, `${index + 1}. ${character.name}`, {
                fontSize: '28px', fontStyle: 'bold', color: '#fff0be'
            }).setOrigin(0.5);
            this.add.text(x, 397, WEAPONS[character.startingWeapon].name, {
                fontSize: '23px', color: '#84e9ef'
            }).setOrigin(0.5);
            this.add.text(x, 449, `Health: ${character.health}   Speed: ${character.moveSpeed}`, {
                fontSize: '19px', color: '#ffffff'
            }).setOrigin(0.5);
            this.add.text(x, 518, character.description, {
                fontSize: '18px', color: '#ffffff', align: 'center', lineSpacing: 8,
                wordWrap: { width: 380 }
            }).setOrigin(0.5);
        });
        this.add.text(512, 641, 'Tap a hero, press 1 / 2, or use ← / → and ENTER', {
            fontSize: '20px', color: '#ffffff'
        }).setOrigin(0.5);
        this.add.text(512, 707, 'MAIN MENU  [ESC]', {
            fontSize: '20px', color: '#ffffff', backgroundColor: '#79507c', padding: { x: 18, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('MainMenu'));
        this.keys = this.input.keyboard!.addKeys('LEFT,RIGHT,A,D,ONE,TWO,ENTER,SPACE,ESC') as typeof this.keys;
        this.highlight();
    }

    private highlight(): void {
        this.cards.forEach((card, index) => card.setStrokeStyle(index === this.selected ? 4 : 2,
            index === this.selected ? 0xffe0a2 : 0xbab0e1));
    }

    private startRun(index: number): void {
        if (this.starting || window.matchMedia('(orientation: portrait)').matches) return;
        const character = this.choices[index];
        if (!character) return;
        this.starting = true;
        this.scene.start('Game', { characterId: character.id });
    }

    update(): void {
        if (Input.Keyboard.JustDown(this.keys.ESC)) { this.scene.start('MainMenu'); return; }
        if (Input.Keyboard.JustDown(this.keys.ONE)) this.startRun(0);
        else if (Input.Keyboard.JustDown(this.keys.TWO)) this.startRun(1);
        else if (Input.Keyboard.JustDown(this.keys.LEFT) || Input.Keyboard.JustDown(this.keys.A)) {
            this.selected = (this.selected + this.choices.length - 1) % this.choices.length;
            this.highlight();
        } else if (Input.Keyboard.JustDown(this.keys.RIGHT) || Input.Keyboard.JustDown(this.keys.D)) {
            this.selected = (this.selected + 1) % this.choices.length;
            this.highlight();
        } else if (Input.Keyboard.JustDown(this.keys.ENTER) || Input.Keyboard.JustDown(this.keys.SPACE)) {
            this.startRun(this.selected);
        }
    }
}
