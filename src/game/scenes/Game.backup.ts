
import * as Phaser from 'phaser';

type BreadEnemy = {
    body: Phaser.GameObjects.Container;
    speed: number;
};

export class Game extends Phaser.Scene {
    private llama!: Phaser.GameObjects.Container;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private keys!: {
        A: Phaser.Input.Keyboard.Key;
        D: Phaser.Input.Keyboard.Key;
        W: Phaser.Input.Keyboard.Key;
        J: Phaser.Input.Keyboard.Key;
        R: Phaser.Input.Keyboard.Key;
    };

    private groundY = 0;
    private velocityY = 0;
    private onGround = true;
    private gameEnded = false;

    private readonly gravity = 1600;
    private readonly jumpPower = -650;
    private readonly moveSpeed = 300;

    private touchLeft = false;
    private touchRight = false;
    private touchJump = false;
    private touchAttack = false;

    private scenery: Phaser.GameObjects.Rectangle[] = [];
    private enemies: BreadEnemy[] = [];

    private health = 5;
    private kills = 0;
    private distance = 0;
    private lastAttack = 0;
    private lastDamage = 0;

    private healthText!: Phaser.GameObjects.Text;
    private scoreText!: Phaser.GameObjects.Text;
    private rosieText!: Phaser.GameObjects.Text;

    constructor() {
        super('Game');
    }

    create() {
        const { width, height } = this.scale;

        // Reset everything on restart
        this.health = 5;
        this.kills = 0;
        this.distance = 0;
        this.lastAttack = -1000;
        this.lastDamage = -1000;
        this.velocityY = 0;
        this.onGround = true;
        this.gameEnded = false;
        this.touchLeft = false;
        this.touchRight = false;
        this.touchJump = false;
        this.touchAttack = false;
        this.enemies = [];
        this.scenery = [];

        this.groundY = height * 0.78;

        // SKY
        this.cameras.main.setBackgroundColor('#b9d9e8');

        // SCROLLING BUILDINGS
        for (let i = 0; i < 9; i++) {
            const building = this.add.rectangle(
                i * 170,
                this.groundY - 125,
                90,
                220,
                0x8396a4,
                0.45
            ).setDepth(0);

            this.scenery.push(building);
        }

        // GROUND
        this.add.rectangle(
            width / 2,
            this.groundY + (height - this.groundY) / 2,
            width,
            height - this.groundY,
            0x64845a
        ).setDepth(1);

        this.add.rectangle(
            width / 2,
            this.groundY + 5,
            width,
            10,
            0x415a3a
        ).setDepth(2);

        // LLAMA CRUNCH
        this.llama = this.add.container(
            170,
            this.groundY - 40
        ).setDepth(5);

        const body = this.add.ellipse(
            0, 0, 65, 75, 0xe8c98f
        );

        const head = this.add.circle(
            0, -23, 24, 0xf1d9ae
        );

        const face = this.add.ellipse(
            0, -20, 20, 16, 0x9d704f
        );

        const ear1 = this.add.ellipse(
            -15, -48, 12, 30, 0xe8c98f
        );

        const ear2 = this.add.ellipse(
            13, -48, 12, 30, 0xe8c98f
        );

        const shield = this.add.circle(
            -24, 12, 19, 0x76513c
        );

        const shieldCentre = this.add.circle(
            -24, 12, 6, 0xc1c1c1
        );

        this.llama.add([
            ear1, ear2, body, head,
            face, shield, shieldCentre
        ]);

        // ROSIE'S CAGE
        const cageX = width - 105;
        const cageY = this.groundY - 125;

        this.add.rectangle(
            cageX, cageY, 110, 155,
            0x575064
        ).setDepth(2);

        this.add.text(
            cageX, cageY - 12, '👸',
            { fontSize: '43px' }
        ).setOrigin(0.5).setDepth(3);

        for (let i = -2; i <= 2; i++) {
            this.add.rectangle(
                cageX + i * 22,
                cageY,
                5,
                155,
                0xc6c0cc
            ).setDepth(4);
        }

        this.rosieText = this.add.text(
            cageX,
            cageY - 120,
            'HURRY UP, LLAMA!',
            {
                fontSize: '15px',
                color: '#43273c',
                backgroundColor: '#fff2de',
                padding: { x: 10, y: 7 },
                align: 'center'
            }
        ).setOrigin(0.5).setDepth(10);

        const insults = [
            'HURRY UP, LLAMA!',
            'YOU CALL THAT FIGHTING?',
            'THE BREAD IS WINNING!',
            'STINKY LLAMA!',
            'I COULD DO BETTER!',
            'ARE YOU EVEN TRYING?'
        ];

        this.time.addEvent({
            delay: 3500,
            loop: true,
            callback: () => {
                if (!this.gameEnded) {
                    this.rosieText.setText(
                        Phaser.Utils.Array.GetRandom(insults)
                    );
                }
            }
        });

        // KEYBOARD
        this.cursors = this.input.keyboard!.createCursorKeys();

        this.keys = this.input.keyboard!.addKeys(
            'A,D,W,J,R'
        ) as typeof this.keys;

        // MOBILE BUTTONS
        this.createTouchButton(
            65, height - 70, '◀', 'left'
        );

        this.createTouchButton(
            155, height - 70, '▶', 'right'
        );

        this.createTouchButton(
            width - 175, height - 70, 'JUMP', 'jump'
        );

        this.createTouchButton(
            width - 70, height - 70, 'ATK', 'attack'
        );

        // HUD
        this.add.text(
            22, 18, 'LLAMA KNIGHT',
            {
                fontSize: '25px',
                color: '#263c37',
                fontStyle: 'bold'
            }
        ).setDepth(20);

        this.healthText = this.add.text(
            22, 53, '',
            {
                fontSize: '20px',
                color: '#8c263b'
            }
        ).setDepth(20);

        this.scoreText = this.add.text(
            22, 85, '',
            {
                fontSize: '17px',
                color: '#263c37'
            }
        ).setDepth(20);

        this.updateHUD();

        // SPAWN BREAD ENEMIES
        this.time.addEvent({
            delay: 1450,
            loop: true,
            callback: () => {
                if (!this.gameEnded) {
                    this.spawnBread();
                }
            }
        });
    }

    private createTouchButton(
        x: number,
        y: number,
        label: string,
        action: 'left' | 'right' | 'jump' | 'attack'
    ) {
        const button = this.add.circle(
            x, y, 36, 0x25263f, 0.7
        ).setDepth(30).setInteractive();

        this.add.text(x, y, label, {
            fontSize:
                label.length > 2 ? '13px' : '27px',
            color: '#ffffff'
        }).setOrigin(0.5).setDepth(31);

        const setPressed = (pressed: boolean) => {
            if (action === 'left') this.touchLeft = pressed;
            if (action === 'right') this.touchRight = pressed;
            if (action === 'jump') this.touchJump = pressed;
            if (action === 'attack') this.touchAttack = pressed;
        };

        button.on('pointerdown', () => setPressed(true));
        button.on('pointerup', () => setPressed(false));
        button.on('pointerout', () => setPressed(false));

        this.input.on('pointerup', () => {
            setPressed(false);
        });
    }

    private spawnBread() {
        const width = this.scale.width;

        const bread = this.add.container(
            width + 50,
            this.groundY - 32
        ).setDepth(5);

        const crust = this.add.rectangle(
            0, 0, 57, 65, 0x9c612f
        ).setStrokeStyle(3, 0x563718);

        const inside = this.add.rectangle(
            0, 0, 46, 54, 0xeac38b
        );

        const eye1 = this.add.circle(
            -11, -7, 3, 0x2d211b
        );

        const eye2 = this.add.circle(
            11, -7, 3, 0x2d211b
        );

        const mouth = this.add.arc(
            0, 8, 8, 0, 180,
            false, 0x4c2e22
        );

        bread.add([
            crust, inside, eye1, eye2, mouth
        ]);

        this.enemies.push({
            body: bread,
            speed: Phaser.Math.Between(165, 235)
        });
    }

    private performAttack() {
        if (this.gameEnded) return;

        if (this.time.now - this.lastAttack < 400) {
            return;
        }

        this.lastAttack = this.time.now;

        // Temporary attack visual
        const slash = this.add.ellipse(
            this.llama.x + 55,
            this.llama.y,
            90,
            75,
            0xffe49c,
            0.55
        ).setDepth(6);

        this.tweens.add({
            targets: slash,
            alpha: 0,
            scaleX: 1.4,
            duration: 170,
            onComplete: () => slash.destroy()
        });

        // Hit enemies in front of the llama
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];

            const dx = enemy.body.x - this.llama.x;
            const dy = Math.abs(
                enemy.body.y - this.llama.y
            );

            if (dx > -5 && dx < 115 && dy < 75) {
                const x = enemy.body.x;
                const y = enemy.body.y;

                enemy.body.destroy();
                this.enemies.splice(i, 1);

                this.kills++;
                this.updateHUD();

                const pop = this.add.text(
                    x, y - 35, '+1 BREAD',
                    {
                        fontSize: '17px',
                        color: '#fff8d0',
                        stroke: '#403024',
                        strokeThickness: 4
                    }
                ).setOrigin(0.5).setDepth(15);

                this.tweens.add({
                    targets: pop,
                    y: pop.y - 45,
                    alpha: 0,
                    duration: 650,
                    onComplete: () => pop.destroy()
                });
            }
        }
    }

    private takeDamage() {
        if (this.time.now - this.lastDamage < 950) {
            return;
        }

        this.lastDamage = this.time.now;
        this.health--;
        this.updateHUD();

        this.cameras.main.shake(120, 0.004);

        this.tweens.add({
            targets: this.llama,
            alpha: 0.35,
            duration: 90,
            yoyo: true,
            repeat: 5,
            onComplete: () => {
                this.llama.setAlpha(1);
            }
        });

        if (this.health <= 0) {
            this.endGame();
        }
    }

    private updateHUD() {
        this.healthText.setText(
            'HEALTH: ' + '♥ '.repeat(this.health)
        );

        this.scoreText.setText(
            'BREAD DEFEATED: ' + this.kills +
            '   DISTANCE: ' + Math.floor(this.distance) + 'm'
        );
    }

    private endGame() {
        this.gameEnded = true;

        const { width, height } = this.scale;

        this.add.rectangle(
            width / 2,
            height / 2,
            width,
            height,
            0x151424,
            0.85
        ).setDepth(90);

        this.add.text(
            width / 2,
            height / 2 - 85,
            'THE BREAD HAS WON.',
            {
                fontSize: '36px',
                color: '#ffffff',
                fontStyle: 'bold',
                align: 'center'
            }
        ).setOrigin(0.5).setDepth(91);

        this.add.text(
            width / 2,
            height / 2,
            `Bread defeated: ${this.kills}\n` +
            `Distance: ${Math.floor(this.distance)}m`,
            {
                fontSize: '22px',
                color: '#f8d99b',
                align: 'center'
            }
        ).setOrigin(0.5).setDepth(91);

        const restart = this.add.text(
            width / 2,
            height / 2 + 110,
            'TAP HERE OR PRESS R TO RESTART',
            {
                fontSize: '19px',
                color: '#ffffff',
                backgroundColor: '#79507c',
                padding: { x: 18, y: 14 }
            }
        ).setOrigin(0.5).setDepth(91);

        restart.setInteractive();
        restart.on('pointerdown', () => {
            this.scene.restart();
        });
    }

    update(_time: number, delta: number) {
        if (this.gameEnded) {
            if (Phaser.Input.Keyboard.JustDown(this.keys.R)) {
                this.scene.restart();
            }
            return;
        }

        const dt = Math.min(delta / 1000, 0.05);

        const left =
            this.cursors.left.isDown ||
            this.keys.A.isDown ||
            this.touchLeft;

        const right =
            this.cursors.right.isDown ||
            this.keys.D.isDown ||
            this.touchRight;

        const jump =
            this.cursors.up.isDown ||
            this.cursors.space.isDown ||
            this.keys.W.isDown ||
            this.touchJump;

        const attack =
            this.keys.J.isDown ||
            this.touchAttack;

        // PLAYER MOVEMENT
        if (left) {
            this.llama.x -= this.moveSpeed * dt;
        }

        if (right) {
            this.llama.x += this.moveSpeed * dt;
        }

        this.llama.x = Phaser.Math.Clamp(
            this.llama.x,
            45,
            this.scale.width * 0.36
        );

        // JUMP
        if (jump && this.onGround) {
            this.velocityY = this.jumpPower;
            this.onGround = false;
        }

        if (!this.onGround) {
            this.velocityY += this.gravity * dt;
            this.llama.y += this.velocityY * dt;
        }

        if (this.llama.y >= this.groundY - 40) {
            this.llama.y = this.groundY - 40;
            this.velocityY = 0;
            this.onGround = true;
        }

        // ATTACK
        if (attack) {
            this.performAttack();
        }

        // SCROLLING BACKGROUND
        for (const building of this.scenery) {
            building.x -= 90 * dt;

            if (building.x < -100) {
                building.x += this.scenery.length * 170;
            }
        }

        // ENEMY MOVEMENT & COLLISIONS
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];

            enemy.body.x -= enemy.speed * dt;

            const dx = Math.abs(
                enemy.body.x - this.llama.x
            );

            const dy = Math.abs(
                enemy.body.y - this.llama.y
            );

            if (dx < 45 && dy < 55) {
                this.takeDamage();
            }

            if (enemy.body.x < -70) {
                enemy.body.destroy();
                this.enemies.splice(i, 1);
            }
        }

        // DISTANCE SCORE
        this.distance += 11 * dt;
        this.updateHUD();
    }
}
