import * as Phaser from 'phaser';
import { WORLD } from '../config/world';
import { WorldDebug } from '../ui/WorldDebug';
import { WorldCamera } from '../world/WorldCamera';
import { WorldSystem } from '../world/WorldSystem';
import { BALANCE } from '../config/balance';
import { UPGRADES } from '../data/upgrades';
import { applyUpgrade } from '../systems/applyUpgrade';
import { selectUpgrades } from '../systems/selectUpgrades';
import { Hud } from '../ui/Hud';
import { createUpgradePanel } from '../ui/UpgradePanel';
import { createGameOverPanel } from '../ui/GameOverPanel';
import { Rosie } from '../world/Rosie';
import type { Upgrade } from '../data/upgrades';
import { createRunState } from '../state/RunState';
import type { RunPhase } from '../state/RunState';
import { Player } from '../entities/Player';
import { PlayerInput } from '../input/PlayerInput';
import { EnemySystem } from '../systems/EnemySystem';
import { CombatSystem } from '../systems/CombatSystem';
import { isCharacterId } from '../characters/definitions';
import type { CharacterId } from '../characters/definitions';
import { XpSystem } from '../systems/XpSystem';

export class Game extends Phaser.Scene {
    private selectedCharacter: CharacterId = 'llamaCrunch';
    private rosie!: Rosie;
    private player!: Player;
    private playerInput!: PlayerInput;
    private worldCamera!: WorldCamera;
    private debug?: WorldDebug;
    private world!: WorldSystem;
    private enemySystem!: EnemySystem;
    private combatSystem!: CombatSystem;
    private xpSystem!: XpSystem;
    private groundY = 0;
    private run = createRunState();
    private upgradePanel?: Phaser.GameObjects.Container;
    private offered: Upgrade[] = [];
    private hud!: Hud;
    private pauseReasons = new Set<string>();
    private phaseBeforePause: Exclude<RunPhase, 'paused'> = 'playing';

    constructor() { super('Game'); }

    init(data: { characterId?: unknown } = {}): void {
        this.selectedCharacter = isCharacterId(data.characterId) ? data.characterId : 'llamaCrunch';
    }

    create() {
        const { height } = this.scale;
        this.groundY = height * BALANCE.player.groundHeightRatio;
        this.run = createRunState(this.selectedCharacter);
        this.pauseReasons.clear();
        this.phaseBeforePause = 'playing';
        this.time.paused = false;
        this.tweens.resumeAll();
        this.tweens.timeScale = 1;
        this.offered = [];
        this.upgradePanel = undefined;
        this.debug = undefined;

        this.cameras.main.setBackgroundColor('#b9d9e8');
        this.player = new Player(this, this.run, this.groundY);
        this.run.startX = this.run.furthestX = this.player.x;
        this.worldCamera = new WorldCamera(this.cameras.main, height);
        this.world = new WorldSystem(this, this.run.seed, this.groundY);

        this.rosie = new Rosie(this, this.run);

        this.playerInput = new PlayerInput(this, () => this.run.phase === 'playing');

        this.enemySystem = new EnemySystem(this, this.run, this.groundY);
        this.enemySystem.prepare(); // Before the first gameplay render, including both approach buffers.
        this.xpSystem = new XpSystem(this, this.run, this.player,
            () => this.openLevelUp(), () => this.updateHud());
        this.combatSystem = new CombatSystem(this, this.run, this.player, this.enemySystem,
            (x, y) => this.xpSystem.dropGem(x, y), () => this.endGame(), () => this.updateHud(), () => this.rosie.speak('damage'));

        this.hud = new Hud(this);
        if (WORLD.debugOverlay) {
            this.debug = new WorldDebug(this);
            this.debug.resetSample(this.player, this.cameras.main);
        }
        this.updateHud();
        this.bindPauseEvents();
    }

    private updateHud() {
        this.hud.update(this.run, this.xpSystem.xpNeeded());
    }

    private openLevelUp() {
        this.setPhase('choosingUpgrade');
        const rosieLine = this.rosie.speak('levelUp');
        this.playerInput.clearTouch();
        this.offered = selectUpgrades(UPGRADES);
        this.upgradePanel = createUpgradePanel(this, this.run.level, this.offered,
            (index) => this.chooseUpgrade(index), rosieLine);
    }

    private chooseUpgrade(index: number) {
        if (this.run.phase !== 'choosingUpgrade' || !this.offered[index]) return;
        applyUpgrade(this.run, this.offered[index].id);
        this.upgradePanel?.destroy();
        this.upgradePanel = undefined;
        this.setPhase('playing');
        this.run.weapon.lastAttack = this.run.runTime * 1000;
        this.updateHud();
        this.xpSystem.checkLevelUp();
    }

    private endGame() {
        if (this.run.phase === 'gameOver') return;
        this.playerInput.clearAll();
        this.setPhase('gameOver');
        this.player.showDeath();
        const rosieLine = this.rosie.speak('death');
        createGameOverPanel(this, this.run, () => this.restartRun(), () => this.returnToMenu(), rosieLine);
    }

    private setPhase(phase: RunPhase): void {
        this.run.phase = phase;
        this.debug?.resetSample(this.player, this.cameras.main);
        this.player.setVisualPhase(phase);
        this.combatSystem.setVisualPhase(phase);
        const frozen = phase !== 'playing';
        this.time.paused = frozen;
        // Keep Phaser's tween clock ticking with zero progression while frozen.
        // Pausing the manager itself can include the pause gap in its next delta.
        this.tweens.timeScale = frozen ? 0 : 1;
        if (frozen) this.playerInput.clearTouch();
    }

    private restartRun(): void {
        if (this.run.phase === 'gameOver' && this.pauseReasons.size === 0) {
            this.scene.restart({ characterId: this.run.characterId });
        }
    }

    private returnToMenu(): void {
        if (this.run.phase === 'gameOver' && this.pauseReasons.size === 0) this.scene.start('MainMenu');
    }

    private setPauseReason(reason: string, active: boolean): void {
        if (active) this.playerInput.clearAll();
        if (active) this.pauseReasons.add(reason);
        else this.pauseReasons.delete(reason);
        if (this.pauseReasons.size > 0 && this.run.phase !== 'paused' && this.run.phase !== 'gameOver') {
            this.phaseBeforePause = this.run.phase;
            this.setPhase('paused');
        } else if (this.pauseReasons.size === 0 && this.run.phase === 'paused') {
            this.playerInput.clearAll();
            this.setPhase(this.phaseBeforePause);
        }
        // Game-over remains terminal, but its visual-only death animation can still pause.
        this.player.setVisualPhase(this.pauseReasons.size > 0 ? 'paused' : this.run.phase);
    }

    private bindPauseEvents(): void {
        const blur = () => this.setPauseReason('focus', true);
        const focus = () => this.setPauseReason('focus', false);
        const hidden = () => this.setPauseReason('hidden', true);
        const visible = () => this.setPauseReason('hidden', false);
        const orientation = window.matchMedia('(orientation: portrait)');
        const orientationChanged = () => {
            this.playerInput.clearAll();
            this.setPauseReason('portrait', orientation.matches);
        };
        orientation.addEventListener('change', orientationChanged);
        this.game.events.on(Phaser.Core.Events.BLUR, blur);
        this.game.events.on(Phaser.Core.Events.FOCUS, focus);
        this.game.events.on(Phaser.Core.Events.HIDDEN, hidden);
        this.game.events.on(Phaser.Core.Events.VISIBLE, visible);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.game.events.off(Phaser.Core.Events.BLUR, blur);
            this.game.events.off(Phaser.Core.Events.FOCUS, focus);
            this.game.events.off(Phaser.Core.Events.HIDDEN, hidden);
            this.game.events.off(Phaser.Core.Events.VISIBLE, visible);
            orientation.removeEventListener('change', orientationChanged);
            this.pauseReasons.clear();
            this.time.paused = false;
        });
        orientationChanged();
        this.setPauseReason('hidden', document.hidden);
        this.setPauseReason('focus', !document.hasFocus());
    }

    update(_time: number, delta: number) {
        if (this.run.phase === 'gameOver') {
            if (this.playerInput.restartPressed()) this.restartRun();
            else if (this.playerInput.menuPressed()) this.returnToMenu();
            return;
        }
        if (this.run.phase === 'choosingUpgrade') {
            const choice = this.playerInput.upgradeChoice();
            if (choice !== undefined) this.chooseUpgrade(choice);
            return;
        }
        if (this.run.phase !== 'playing') return;
        // Preserve wall-clock movement on slow frames without increasing physics step size.
        const frameDt = Math.min(Math.max(0, delta / 1000), WORLD.maxCatchUpSeconds);
        const steps = Math.max(1, Math.ceil(frameDt / BALANCE.simulation.maxDeltaSeconds));
        const dt = frameDt / steps;
        const actions = this.playerInput.readActions();
        let simulatedMs = 0;
        for (let step = 0; step < steps; step++) {
            if (this.run.phase !== 'playing') break;
            this.run.runTime += dt;
            simulatedMs += dt * 1000;
            this.player.update(actions, dt);
            this.run.furthestX = Math.max(this.run.furthestX, this.player.x);
            this.run.distance = Math.max(0, this.run.furthestX - this.run.startX) / WORLD.pixelsPerMetre;
            this.worldCamera.update(this.player.x, dt);
            this.world.update();
            this.enemySystem.prepare();
            if (actions.attack) this.combatSystem.attack();
            this.combatSystem.update(dt);
            this.enemySystem.update(dt, (enemy) => this.combatSystem.checkContact(enemy));
            if (this.run.phase !== 'playing') break;
            this.xpSystem.update(dt);
        }
        this.debug?.update(this.player, this.cameras.main, this.enemySystem.enemies, delta, simulatedMs, this.run.moveSpeed);
        this.updateHud();
    }

}
