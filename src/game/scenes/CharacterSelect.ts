import { Scene, Input, GameObjects } from 'phaser';
import { CHARACTERS } from '../characters/definitions';
import { WEAPONS } from '../weapons/definitions';
import { createPlayerVisual } from '../entities/Player';
import { isMobileLayout, onLayoutResize } from '../ui/layout';

export class CharacterSelect extends Scene {
    private choices = Object.values(CHARACTERS);
    private selected = 0;
    private starting = false;
    private panel!: GameObjects.Container;
    private cards: GameObjects.Rectangle[] = [];
    private keys!: Record<'LEFT' | 'RIGHT' | 'A' | 'D' | 'ONE' | 'TWO' | 'ENTER' | 'SPACE' | 'ESC', Input.Keyboard.Key>;

    constructor() { super('CharacterSelect'); }

    create(): void {
        this.selected = 0;
        this.starting = false;
        this.cards = [];
        this.cameras.main.setBackgroundColor('#151527');
        this.panel = this.add.container(0, 0);
        this.renderChoices();
        onLayoutResize(this, () => this.renderChoices());
        this.keys = this.input.keyboard!.addKeys('LEFT,RIGHT,A,D,ONE,TWO,ENTER,SPACE,ESC') as typeof this.keys;
        this.highlight();
    }

    private renderChoices(): void {
        this.panel.removeAll(true);
        this.cards = [];
        const { width } = this.scale;
        const mobile = isMobileLayout();
        const cardWidth = mobile ? Math.min(600, width * 0.4) : 420;
        this.panel.add(this.add.text(width / 2, 76, 'CHOOSE YOUR HERO', {
            fontFamily: 'Arial Black', fontSize: '38px', color: '#ffe0a2'
        }).setOrigin(0.5));
        this.choices.forEach((character, index) => {
            const x = mobile ? width * (index === 0 ? 0.28 : 0.72) : 280 + index * 464;
            const card = this.add.rectangle(x, 370, cardWidth, 440, 0x45405f)
                .setInteractive({ useHandCursor: true });
            card.on('pointerdown', () => this.startRun(index));
            this.cards.push(card); this.panel.add(card);
            this.panel.add(createPlayerVisual(this, x, 265, character.visual));
            this.panel.add(this.add.text(x, 344, `${index + 1}. ${character.name}`, {
                fontSize: mobile ? '36px' : '28px', fontStyle: 'bold', color: '#fff0be'
            }).setOrigin(0.5));
            this.panel.add(this.add.text(x, 397, WEAPONS[character.startingWeapon].name, {
                fontSize: mobile ? '34px' : '23px', color: '#84e9ef'
            }).setOrigin(0.5));
            this.panel.add(this.add.text(x, 449, `Health: ${character.health}   Speed: ${character.moveSpeed}`, {
                fontSize: mobile ? '28px' : '19px', color: '#ffffff'
            }).setOrigin(0.5));
            this.panel.add(this.add.text(x, 518, character.description, {
                fontSize: mobile ? '28px' : '18px', color: '#ffffff', align: 'center', lineSpacing: 8,
                wordWrap: { width: cardWidth - 40 }
            }).setOrigin(0.5));
        });
        this.panel.add(this.add.text(width / 2, mobile ? 620 : 641, mobile ? 'TAP A HERO TO START' : 'Tap a hero, press 1 / 2, or use ← / → and ENTER', {
            fontSize: mobile ? '30px' : '20px', color: '#ffffff'
        }).setOrigin(0.5));
        this.panel.add(this.add.text(width / 2, 707, mobile ? 'MAIN MENU' : 'MAIN MENU  [ESC]', {
            fontSize: mobile ? '30px' : '20px', color: '#ffffff', backgroundColor: '#79507c', padding: { x: 18, y: mobile ? 30 : 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('MainMenu')));
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
