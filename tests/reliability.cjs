// Focused Node checks for game transitions and systems, with a Phaser-shaped scene.
// Run: node tests/reliability.cjs. Real touch/layout checks still require a browser.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const EventEmitter = require('eventemitter3');
const orientation = Object.assign(new EventEmitter(), {
    matches: false,
    addEventListener(event, fn) { this.on(event, fn); },
    removeEventListener(event, fn) { this.off(event, fn); }
});
const screenOrientation = Object.assign(new EventEmitter(), {
    addEventListener(event, fn) { this.on(event, fn); },
    removeEventListener(event, fn) { this.off(event, fn); }
});
const windowStub = Object.assign(new EventEmitter(), {
    matchMedia: () => orientation, screen: { orientation: screenOrientation },
    addEventListener(event, fn) { this.on(event, fn); },
    removeEventListener(event, fn) { this.off(event, fn); }
});
const parentElement = {};
const documentStub = { hidden: false, hasFocus: () => true, getElementById: () => parentElement };
const observers = [];
class ResizeObserverStub {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(element) { this.element = element; }
    disconnect() { this.disconnected = true; }
}
const phaser = {
    Scene: class {},
    AUTO: 0, Scale: { FIT: 3, CENTER_BOTH: 1 },
    Game: class {
        constructor(config) {
            this.config = config; this.events = new EventEmitter(); this.isBooted = true;
            this.refreshes = 0; this.scale = { refresh: () => this.refreshes++ };
        }
    },
    Input: { Keyboard: { JustDown(key) { const value = key._justDown; key._justDown = false; return value; } } },
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
    Core: { Events: { BLUR: 'blur', FOCUS: 'focus', HIDDEN: 'hidden', VISIBLE: 'visible', DESTROY: 'destroy' } },
    Math: { Between: (min, max) => Math.floor((min + max) / 2), Clamp: (value, min, max) => Math.max(min, Math.min(max, value)) },
    Utils: { Array: { GetRandom: values => values[0], Shuffle: values => values } }
};
const cache = new Map();
function load(name, baseUrl = '/') {
    const cacheKey = `${baseUrl}:${name}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const exports = {};
    const source = fs.readFileSync(path.join(__dirname, '../src/game', `${name}.ts`), 'utf8');
    // Vite replaces this expression at build time; emulate it in the CommonJS VM.
    const code = ts.transpileModule(source.replaceAll('import.meta.env.BASE_URL', JSON.stringify(baseUrl)), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    }).outputText;
    vm.runInNewContext(code, {
        exports, document: documentStub, window: windowStub, ResizeObserver: ResizeObserverStub,
        require(dep) {
            if (dep === 'phaser') return phaser;
            const target = path.posix.normalize(path.posix.join(path.posix.dirname(name), dep));
            if (target === 'ui/UpgradePanel') return { createUpgradePanel: () => ({ destroy() {} }) };
            if (target === 'ui/GameOverPanel') return { createGameOverPanel() {} };
            return load(target, baseUrl);
        }
    });
    cache.set(cacheKey, exports);
    return exports;
}
const { createRunState } = load('state/RunState');
const { WORLD } = load('config/world');
const { WorldCamera } = load('world/WorldCamera');
const { WorldSystem } = load('world/WorldSystem');
const { breadPlacementId, generateSection, sectionSeed } = load('world/sections');
const { Game } = load('scenes/Game');
const { EnemySystem } = load('systems/EnemySystem');
const { CombatSystem } = load('systems/CombatSystem');
const { XpSystem } = load('systems/XpSystem');
const { Rosie } = load('world/Rosie');

function fixture(characterId = 'llamaCrunch') {
    const game = new Game();
    const objects = [], timers = [], tweens = [];
    function shape(kind, x, y, ...args) {
        const item = Object.assign(new EventEmitter(), {
            kind, x, y, scaleX: 1, scaleY: 1, args, active: true, alpha: 1, children: [], text: args[0], textChanges: 0,
            fillStyle() { return this; }, beginPath() { return this; }, moveTo() { return this; },
            arc() { return this; }, lineTo() { return this; }, closePath() { return this; }, fillPath() { return this; },
            setScrollFactor(x, y = x, updateChildren = false) {
                this.scrollFactorX = x; this.scrollFactorY = y;
                // Phaser 4 Container uses SetAll, which only sets existing own properties.
                if (updateChildren) this.children.forEach(child => {
                    if (Object.hasOwn(child, 'scrollFactorX')) child.scrollFactorX = x;
                    if (Object.hasOwn(child, 'scrollFactorY')) child.scrollFactorY = y;
                });
                return this;
            },
            setVisible(value) { this.visible = value; return this; },
            setDepth() { return this; }, setStrokeStyle() { return this; },
            setAngle() { return this; }, setOrigin() { return this; }, setInteractive() { return this; },
            add(children) { this.children.push(...[].concat(children)); this.list = this.children; return this; },
            setAlpha(value) { this.alpha = value; return this; },
            setText(value) { this.text = value; this.textChanges++; return this; },
            destroy() { this.active = false; this.removeAllListeners(); this.children.forEach(child => child.destroy()); }
        });
        objects.push(item);
        return item;
    }
    game.scale = { width: 1024, height: 768 };
    game.events = new EventEmitter();
    game.game = { events: new EventEmitter() };
    game.transitions = [];
    game.scene = { restart(data) { game.transitions.push(['restart', data]); }, start(key, data) { game.transitions.push(['start', key, data]); } };
    game.add = Object.fromEntries(['container', 'rectangle', 'circle', 'ellipse', 'text', 'image', 'graphics'].map(kind => [kind, (...args) => shape(kind, ...args)]));
    game.time = {
        now: 0, paused: false,
        delayedCall(delay, callback) { return this.addEvent({ delay, callback }); },
        addEvent(config) {
            const timer = { ...config, elapsed: 0, removed: false, remove() { this.removed = true; } };
            timers.push(timer);
            return timer;
        }
    };
    game.tweens = {
        paused: false, timeScale: 1, pauseAll() { this.paused = true; }, resumeAll() { this.paused = false; },
        add(config) {
            const tween = { config, elapsed: 0, removed: false, remove() { this.removed = true; } };
            tweens.push(tween);
            return tween;
        }
    };
    game.cameras = { main: { width: 1024, height: 768, scrollX: 0, scrollY: 0,
        setBounds(x, y, width, height) { this.bounds = { x, y, width, height }; return this; },
        setScroll(x, y) { this.scrollX = x; this.scrollY = y; return this; },
        setBackgroundColor() {}, shakeEffect: { isRunning: false }, shake() { this.shakeEffect.isRunning = true; } } };
    game.groundY = 768 * 0.78;
    game.run = createRunState(characterId);
    game.player = { facing: 1, x: 300, y: game.groundY - 40, sprite: shape('player', 300, game.groundY - 40), update() {}, showAttack() {}, showHurt() {}, showDeath() {}, setVisualPhase() {} };
    game.run.startX = game.run.furthestX = game.player.x;
    game.playerInput = {
        clearTouch() {}, clearAll() {}, readActions: () => ({ left: false, right: false, jump: false, attack: false }),
        restartPressed: () => false, menuPressed: () => false, upgradeChoice: () => undefined
    };
    game.hud = { update() {} };
    game.worldCamera = new WorldCamera(game.cameras.main, game.scale.height);
    game.world = new WorldSystem(game, game.run.seed, game.groundY);
    game.enemySystem = new EnemySystem(game, game.run, game.groundY);
    game.xpSystem = new XpSystem(game, game.run, game.player, () => game.openLevelUp(), () => game.updateHud());
    game.combatSystem = new CombatSystem(game, game.run, game.player, game.enemySystem,
        (x, y) => game.xpSystem.dropGem(x, y), () => game.endGame(), () => game.updateHud(), () => game.rosie.speak('damage'));
    const rosie = new Rosie(game, game.run);
    game.rosie = rosie;
    function advance(ms) {
        game.time.now += ms;
        if (!game.time.paused) for (const timer of [...timers]) {
            if (timer.removed) continue;
            timer.elapsed += ms;
            if (timer.elapsed >= timer.delay) {
                if (timer.loop) timer.elapsed -= timer.delay;
                else timer.removed = true;
                timer.callback();
            }
        }
        if (!game.tweens.paused && game.tweens.timeScale > 0) for (const tween of tweens) {
            if (tween.removed) continue;
            tween.elapsed += ms;
            if (tween.elapsed >= tween.config.duration * (tween.config.yoyo ? 2 : 1) * ((tween.config.repeat || 0) + 1)) {
                tween.removed = true;
                tween.config.onComplete();
            }
        }
    }
    return { game, objects, timers, tweens, rosie, advance };
}

// Pause keeps simulation, cooldowns, timers, feedback and dialogue frozen.
{
    const { game: g, rosie, advance } = fixture();
    g.enemySystem.spawnBread();
    const enemy = g.enemySystem.enemies[0];
    enemy.hp = 3; enemy.sprite.x = g.player.x + 50; enemy.sprite.y = g.player.y;
    g.combatSystem.attack();
    assert.equal(enemy.hp, 1);
    advance(40);
    g.run.xp = 3;
    g.xpSystem.checkLevelUp();
    assert.equal(g.run.phase, 'choosingUpgrade');
    const dialogueChanges = rosie.speech.textChanges;
    assert.equal(g.time.paused, true);
    assert.equal(g.tweens.timeScale, 0);
    const snapshot = JSON.stringify(g.run), x = enemy.sprite.x;
    advance(10000);
    g.update(10000, 16);
    g.enemySystem.update(1, () => assert.fail('contact while frozen'));
    g.combatSystem.attack();
    g.xpSystem.update(1);
    assert.equal(JSON.stringify(g.run), snapshot);
    assert.equal(enemy.sprite.x, x);
    assert.equal(enemy.sprite.alpha, 0.5);
    assert.equal(rosie.speech.textChanges, dialogueChanges);
    g.chooseUpgrade(0);
    assert.equal(g.run.phase, 'playing');
    advance(59); assert.equal(enemy.sprite.alpha, 0.5);
    advance(1); assert.equal(enemy.sprite.alpha, 1);
    g.run.runTime = 0.499;
    g.combatSystem.attack(); assert.equal(enemy.hp, 1);
    g.run.runTime = 0.500;
    g.combatSystem.attack(); assert.equal(g.run.kills, 1);
    advance(WORLD.rosieDialogueInterval - 60); assert.equal(rosie.speech.textChanges, dialogueChanges + 1);
}

// Fatal contact stops the enemy loop and prevents XP/level-up processing that frame.
{
    const { game: g } = fixture();
    g.run.health = 1;
    g.enemySystem.spawnBread(); g.enemySystem.spawnBread(WORLD.enemyStartX + WORLD.enemySpacing);
    for (const enemy of g.enemySystem.enemies) {
        enemy.sprite.x = g.player.x; enemy.sprite.y = g.player.y;
    }
    const untouched = g.enemySystem.enemies[0];
    g.xpSystem.dropGem(g.player.x, g.player.y);
    g.run.xp = 2;
    g.update(16, 16);
    assert.equal(g.run.phase, 'gameOver');
    assert.equal(g.run.health, 0);
    assert.equal(g.run.xp, 2);
    assert.equal(g.run.level, 1);
    assert.equal(g.xpSystem.gems.length, 1);
    assert.equal(untouched.sprite.x, g.player.x);
    const snapshot = JSON.stringify(g.run);
    g.combatSystem.checkContact(untouched); g.combatSystem.attack(); g.xpSystem.checkLevelUp();
    g.update(32, 16);
    assert.equal(JSON.stringify(g.run), snapshot);
}

// Nested interruption restores the upgrade screen and removes game-level listeners.
{
    const { game: g } = fixture();
    g.bindPauseEvents();
    g.run.xp = 3; g.xpSystem.checkLevelUp();
    g.game.events.emit('blur'); g.game.events.emit('hidden');
    assert.equal(g.run.phase, 'paused');
    g.game.events.emit('focus'); assert.equal(g.run.phase, 'paused');
    g.game.events.emit('visible'); assert.equal(g.run.phase, 'choosingUpgrade');
    assert.equal(g.time.paused, true);
    g.chooseUpgrade(1); assert.equal(g.run.phase, 'playing');
    g.events.emit('shutdown');
    assert.equal(g.game.events.eventNames().length, 0);
    assert.equal(g.events.listenerCount('shutdown'), 0);
}

// Clean restart defaults; no remaining system callbacks or objects after shutdown.
for (let cycle = 0; cycle < 10; cycle++) {
    const { game: g, timers, tweens, advance } = fixture();
    g.enemySystem.spawnBread();
    const enemy = g.enemySystem.enemies[0];
    enemy.hp = 3; enemy.sprite.x = g.player.x + 20; enemy.sprite.y = g.player.y;
    g.combatSystem.attack(); g.combatSystem.checkContact(enemy);
    g.xpSystem.dropGem(500, 400);
    g.events.emit('shutdown');
    assert.equal(g.enemySystem.enemies.length, 0);
    assert.equal(g.xpSystem.gems.length, 0);
    assert.ok(timers.every(timer => timer.removed));
    assert.ok(tweens.every(tween => tween.removed));
    const fresh = createRunState();
    assert.equal(fresh.phase, 'playing'); assert.equal(fresh.runTime, 0);
    assert.equal(fresh.health, 6); assert.equal(fresh.weapon.lastAttack, -1000);
    const snapshot = JSON.stringify(g.run); advance(10000);
    assert.equal(JSON.stringify(g.run), snapshot);
}
console.log('PASS Step A: pause/resume, cooldown/timer preservation, fatal-frame cutoff, nested interruption, fresh runs and shutdown cleanup.');

// Portrait blocks gameplay; returning to landscape preserves the upgrade screen.
{
    const { game: g } = fixture();
    g.bindPauseEvents();
    g.run.xp = 3; g.xpSystem.checkLevelUp();
    orientation.matches = true; orientation.emit('change');
    assert.equal(g.run.phase, 'paused');
    const snapshot = JSON.stringify(g.run);
    g.update(1000, 1000);
    g.chooseUpgrade(0);
    assert.equal(JSON.stringify(g.run), snapshot);
    g.game.events.emit('blur');
    orientation.matches = false; orientation.emit('change');
    assert.equal(g.run.phase, 'paused');
    g.game.events.emit('focus');
    assert.equal(g.run.phase, 'choosingUpgrade');
    g.events.emit('shutdown');
    assert.equal(orientation.listenerCount('change'), 0);
}
console.log('PASS Step B: portrait pause, nested focus/orientation interruptions, upgrade preservation and orientation listener cleanup.');

// Independent fingers, keyboard parity, cancellation, interruption and cleanup.
const { PlayerInput } = load('input/PlayerInput');
for (let cycle = 0; cycle < 10; cycle++) {
    const { game: g, objects } = fixture();
    const allKeys = [];
    function key() {
        const value = { isDown: false, _justDown: false, reset() { this.isDown = false; this._justDown = false; } };
        allKeys.push(value);
        return value;
    }
    g.input = Object.assign(new EventEmitter(), {
        mousePointer: { id: 0 },
        keyboard: {
            createCursorKeys: () => Object.fromEntries(['left', 'right', 'up', 'down', 'space', 'shift'].map(name => [name, key()])),
            addKeys: names => Object.fromEntries(names.split(',').map(name => [name, key()])),
            addCapture() {}, resetKeys() { allKeys.forEach(value => value.reset()); }
        }
    });
    const input = new PlayerInput(g, () => g.run.phase === 'playing');
    g.playerInput = input;
    g.bindPauseEvents();
    const [left, right, jump, attack] = objects.filter(object => object.kind === 'circle' && object.eventNames().includes('pointerdown'));
    const p1 = { id: 1 }, p2 = { id: 2 }, p3 = { id: 3 }, p4 = { id: 4 };
    left.emit('pointerdown', p1); jump.emit('pointerdown', p2); attack.emit('pointerdown', p3);
    assert.equal(input.readActions().left, true);
    assert.equal(input.readActions().jump, true);
    assert.equal(input.readActions().attack, true);
    g.input.emit('pointerup', p2);
    assert.equal(input.readActions().jump, false);
    assert.equal(input.readActions().left, true);
    assert.equal(input.readActions().attack, true);
    left.emit('pointerdown', p4); left.emit('pointerout', p1);
    assert.equal(input.readActions().left, true);
    g.input.emit('pointerupoutside', p4);
    assert.equal(input.readActions().left, false);
    assert.equal(input.readActions().attack, true);
    right.emit('pointerdown', { id: 0 });
    g.input.emit('gameout');
    assert.equal(input.readActions().right, false);
    assert.equal(input.readActions().attack, true);
    g.input.emit('pointerupoutside', p3);
    assert.equal(input.readActions().attack, false);
    // Every original keyboard alias and edge-triggered menu key remains available.
    for (const [value, action] of [
        [input.cursors.left, 'left'], [input.keys.A, 'left'],
        [input.cursors.right, 'right'], [input.keys.D, 'right'],
        [input.cursors.up, 'jump'], [input.cursors.space, 'jump'], [input.keys.W, 'jump'], [input.keys.J, 'attack']
    ]) {
        value.isDown = true; assert.equal(input.readActions()[action], true);
        value.isDown = false; assert.equal(input.readActions()[action], false);
    }
    input.keys.R._justDown = true;
    assert.equal(input.restartPressed(), true); assert.equal(input.restartPressed(), false);
    for (const [name, index] of [['ONE', 0], ['TWO', 1], ['THREE', 2]]) {
        input.keys[name]._justDown = true;
        assert.equal(input.upgradeChoice(), index); assert.equal(input.upgradeChoice(), undefined);
    }
    left.emit('pointerdown', p1); input.keys.J.isDown = true;
    g.game.events.emit('blur');
    assert.equal(g.run.phase, 'paused'); assert.equal(input.keys.J.isDown, false);
    g.game.events.emit('focus');
    assert.equal(input.readActions().left, false); assert.equal(input.readActions().attack, false);
    for (const [target, event] of [[windowStub, 'orientationchange'], [screenOrientation, 'change']]) {
        left.emit('pointerdown', p1); input.keys.J.isDown = true;
        target.emit(event);
        assert.equal(input.readActions().left, false); assert.equal(input.keys.J.isDown, false);
    }
    g.run.xp = g.xpSystem.xpNeeded(); g.xpSystem.checkLevelUp();
    left.emit('pointerdown', p1); attack.emit('pointerdown', p2);
    g.chooseUpgrade(0);
    assert.equal(input.readActions().left, false); assert.equal(input.readActions().attack, false);
    g.events.emit('shutdown');
    assert.equal(g.input.eventNames().length, 0);
    assert.equal(g.game.events.eventNames().length, 0);
    assert.equal(windowStub.eventNames().length, 0);
    assert.equal(screenOrientation.eventNames().length, 0);
    assert.equal(orientation.eventNames().length, 0);
    for (const button of [left, right, jump, attack]) assert.equal(button.eventNames().length, 0);
}
console.log('PASS Step C: independent simultaneous fingers, per-pointer release/cancel/out, keyboard parity, focus/rotation resets, modal gating and 10 listener-cleanup cycles.');

// The browser host only scales the canvas; logical coordinates stay fixed.
{
    const startGame = load('main').default;
    const engine = startGame('game-container');
    assert.equal(engine.config.width, 1024); assert.equal(engine.config.height, 768);
    assert.equal(engine.config.scale.mode, phaser.Scale.FIT);
    assert.equal(engine.config.scale.autoCenter, phaser.Scale.CENTER_BOTH);
    assert.equal(engine.config.input.activePointers, 4);
    assert.equal(engine.config.fps.smoothStep, false); // No 120-frame startup simulation clamp.
    const observer = observers.at(-1);
    assert.equal(observer.element, parentElement);
    observer.callback(); assert.equal(engine.refreshes, 1);
    assert.equal(engine.config.width, 1024); assert.equal(engine.config.height, 768);
    engine.events.emit('destroy'); assert.equal(observer.disconnected, true);
}
console.log('PASS browser host configuration: fixed coordinates, FIT scaling, four touch pointers and resize-observer cleanup.');

// Every Phaser scene loader inherits Vite's deployment base, including public assets.
for (const base of ['./', '/llamaknight/']) {
    const engine = load('main', base).default('game-container');
    assert.equal(engine.config.loader.baseURL, base);
    const { Boot } = load('scenes/Boot', base);
    const { Preloader } = load('scenes/Preloader', base);
    const requests = [];
    const loader = {
        path: '',
        setPath(value) { this.path = value.endsWith('/') ? value : `${value}/`; return this; },
        image(key, file) { requests.push({ key, url: `${engine.config.loader.baseURL}${this.path}${file}` }); },
        spritesheet(key, file) { this.image(key, file); }
    };
    const boot = new Boot(); boot.load = loader; boot.preload();
    const preloader = new Preloader(); preloader.load = loader; preloader.preload();
    const origin = 'https://ianswebsolutions.com/';
    const expected = base === './' ? '/assets/' : '/llamaknight/assets/';
    assert.ok(requests.length >= 7);
    for (const request of requests) {
        const url = new URL(request.url, origin);
        assert.ok(url.pathname.startsWith(expected), `${request.key}: ${url.pathname}`);
        assert.ok(fs.existsSync(path.join(__dirname, '../public/assets', url.pathname.slice(expected.length))));
    }
    engine.events.emit('destroy');
}
console.log('PASS deployment paths: localhost and GitHub Pages Boot, logo, character sheets and sword effect requests.');

const { CHARACTERS } = load('characters/definitions');
const { WEAPONS } = load('weapons/definitions');
const { applyUpgrade } = load('systems/applyUpgrade');
const { Player } = load('entities/Player');
const { getRosieLine } = load('dialogue/rosieDialogue');

// Starting stats, shared jumping, distinguishable visuals, per-run weapon stats.
for (const characterId of ['llamaCrunch', 'candy']) {
    const character = CHARACTERS[characterId];
    assert.equal(character.health, characterId === 'candy' ? 4 : 6);
    assert.equal(character.moveSpeed, characterId === 'candy' ? 350 : 280);
    const { game: g } = fixture(characterId);
    const definition = WEAPONS[character.startingWeapon];
    assert.equal(g.run.health, character.health);
    assert.equal(g.run.moveSpeed, character.moveSpeed);
    assert.equal(g.run.weapon.id, character.startingWeapon);
    assert.equal(g.run.weapon.cooldown, definition.cooldown);
    const player = new Player(g, g.run, g.groundY);
    const start = player.x;
    player.update({ left: false, right: true, jump: true }, 0.05);
    assert.equal(player.x, start + character.moveSpeed * 0.05);
    assert.equal(g.run.velocityY, -570);
    assert.equal(player.y, g.groundY - 40 - 28.5);
    assert.equal(player.sprite.children.length, characterId === 'candy' ? 11 : 7);
    for (let i = 0; i < 100; i++) player.update({ left: false, right: true, jump: false }, 0.05);
    assert.equal(player.x, start + character.moveSpeed * 0.05 * 101);
    assert.equal(player.y, g.groundY - 40);
    for (const id of ['power', 'speed', 'range', 'heart', 'magnet', 'stride']) {
        const state = createRunState(characterId);
        const original = JSON.parse(JSON.stringify(state));
        state.health = 1;
        applyUpgrade(state, id);
        if (id === 'power') assert.equal(state.weapon.damage, definition.damage + 1);
        if (id === 'speed') assert.equal(state.weapon.cooldown, Math.round(definition.cooldown * 0.85));
        if (id === 'range') assert.equal(state.weapon.range, definition.range + 20);
        if (id === 'heart') { assert.equal(state.maxHealth, character.health + 1); assert.equal(state.health, 3); }
        if (id === 'magnet') assert.equal(state.magnetRadius, original.magnetRadius + 45);
        if (id === 'stride') assert.equal(state.moveSpeed, character.moveSpeed * 1.12);
        assert.equal(WEAPONS[character.startingWeapon].damage, definition.damage);
        const fresh = createRunState(characterId, original.seed);
        assert.equal(JSON.stringify(fresh), JSON.stringify(original));
        assert.notEqual(state.weapon, fresh.weapon);
    }
    const fast = createRunState(characterId);
    for (let i = 0; i < 40; i++) applyUpgrade(fast, 'speed');
    assert.equal(fast.weapon.cooldown, 120);
}
console.log('PASS characters: exact starting stats, independent weapon state, shared movement/gravity, distinct visuals and all six upgrades for both heroes.');

// Ranged attacks hit the nearest enemy once, use the same kill/XP path, and respect cooldowns.
{
    const { game: g } = fixture('candy');
    for (const x of [650, 500]) {
        g.enemySystem.spawnBread(WORLD.enemyStartX + g.enemySystem.enemies.length * WORLD.enemySpacing);
        const enemy = g.enemySystem.enemies.at(-1);
        enemy.sprite.x = x; enemy.sprite.y = g.player.y;
    }
    const far = g.enemySystem.enemies[0];
    g.combatSystem.attack();
    assert.equal(g.combatSystem.projectiles.length, 1);
    g.combatSystem.update(0.3);
    assert.equal(g.run.kills, 1); assert.equal(g.enemySystem.enemies.length, 1);
    assert.equal(g.enemySystem.enemies[0], far);
    assert.equal(g.xpSystem.gems.length, 1);
    assert.equal(g.combatSystem.projectiles.length, 0);
    g.run.runTime = 0.899; g.combatSystem.attack();
    assert.equal(g.combatSystem.projectiles.length, 0);
    g.run.runTime = 0.900; g.combatSystem.attack();
    assert.equal(g.combatSystem.projectiles.length, 1);
    g.combatSystem.update(0.8); // Swept collision cannot skip the enemy at large steps.
    assert.equal(g.run.kills, 2);
    assert.equal(g.xpSystem.gems.length, 2);
    // Dropped XP stays at its world position; walk to it instead of waiting for scrolling.
    for (const x of [500, 650]) {
        g.player.x = x;
        for (let frame = 0; frame < 30; frame++) g.xpSystem.update(0.05);
    }
    assert.equal(g.run.xp, 2);
    g.xpSystem.dropGem(g.player.x, g.player.y);
    g.xpSystem.update(0.05);
    assert.equal(g.run.level, 2); assert.equal(g.run.phase, 'choosingUpgrade');
    g.chooseUpgrade(0);
    assert.equal(g.run.weapon.damage, 2);
}

// Projectiles freeze with the run and expire at range, on death, or on shutdown.
{
    const { game: g } = fixture('candy');
    g.combatSystem.attack();
    const shot = g.combatSystem.projectiles[0];
    const x = shot.sprite.x;
    g.run.xp = 3; g.xpSystem.checkLevelUp();
    g.combatSystem.update(10); g.combatSystem.attack();
    assert.equal(shot.sprite.x, x); assert.equal(g.combatSystem.projectiles.length, 1);
    g.chooseUpgrade(0);
    g.combatSystem.update(0.05);
    assert.equal(shot.sprite.x, x + 32.5);
    for (let frame = 0; frame < 30; frame++) g.combatSystem.update(0.05);
    assert.equal(g.combatSystem.projectiles.length, 0); assert.equal(shot.sprite.active, false);
    g.run.runTime = 1; g.combatSystem.attack();
    const finalShot = g.combatSystem.projectiles[0];
    g.endGame();
    g.combatSystem.update(1);
    assert.equal(finalShot.sprite.x, g.player.x + 30);
    g.events.emit('shutdown');
    assert.equal(g.combatSystem.projectiles.length, 0); assert.equal(finalShot.sprite.active, false);
}

// Shots snapshot upgraded stats at firing, stop on a hit, and miss enemies below a jump.
{
    const { game: g, advance } = fixture('candy');
    applyUpgrade(g.run, 'power'); applyUpgrade(g.run, 'range');
    g.enemySystem.spawnBread();
    const enemy = g.enemySystem.enemies[0];
    enemy.hp = 3; enemy.sprite.x = 450; enemy.sprite.y = g.player.y;
    g.combatSystem.attack();
    assert.equal(g.combatSystem.projectiles[0].damage, 2);
    assert.equal(g.combatSystem.projectiles[0].remaining, 670);
    g.combatSystem.update(0.2);
    assert.equal(enemy.hp, 1); assert.equal(enemy.sprite.alpha, 0.5);
    advance(100); assert.equal(enemy.sprite.alpha, 1);
    g.run.runTime = 1; g.player.y -= 150; g.combatSystem.attack();
    for (let i = 0; i < 30; i++) g.combatSystem.update(0.05);
    assert.equal(enemy.hp, 1); assert.equal(g.combatSystem.projectiles.length, 0);
}
console.log('PASS weapons: swept/nearest projectile hits, single-hit shots, cooldowns, shared kill/XP/level-up flow, upgrades, pause, range expiry, jumping misses and cleanup.');

// Character-specific dialogue covers each event and does not tick through a pause.
for (const characterId of ['llamaCrunch', 'candy']) {
    const { game: g, rosie, advance } = fixture(characterId);
    assert.equal(rosie.speech.text, getRosieLine({ characterId, event: 'start' }));
    g.enemySystem.spawnBread();
    const enemy = g.enemySystem.enemies[0];
    enemy.sprite.x = g.player.x; enemy.sprite.y = g.player.y;
    g.combatSystem.checkContact(enemy);
    assert.equal(rosie.speech.text, getRosieLine({ characterId, event: 'damage' }));
    g.run.xp = 3; g.xpSystem.checkLevelUp();
    const levelLine = getRosieLine({ characterId, event: 'levelUp' });
    assert.equal(rosie.speech.text, levelLine);
    advance(10000); assert.equal(rosie.speech.text, levelLine);
    g.chooseUpgrade(0);
    g.run.health = 1; g.run.runTime = 1;
    g.combatSystem.checkContact(enemy);
    assert.equal(g.run.phase, 'gameOver');
    assert.equal(rosie.speech.text, getRosieLine({ characterId, event: 'death' }));
    advance(10000);
    assert.equal(rosie.speech.text, getRosieLine({ characterId, event: 'death' }));
    g.events.emit('shutdown');
}
assert.notEqual(getRosieLine({ characterId: 'candy', event: 'start' }), getRosieLine({ characterId: 'llamaCrunch', event: 'start' }));
console.log('PASS dialogue: character-specific start/damage/level/death events, priority on fatal damage, paused taunts and timer cleanup.');

function installKeyboard(scene) {
    const keys = [];
    const key = () => {
        const value = { isDown: false, _justDown: false, reset() { this.isDown = false; this._justDown = false; } };
        keys.push(value); return value;
    };
    scene.input = Object.assign(new EventEmitter(), { mousePointer: { id: 0 }, keyboard: {
        addKeys: names => Object.fromEntries(names.split(',').map(name => [name, key()])),
        createCursorKeys: () => Object.fromEntries(['left', 'right', 'up', 'down', 'space', 'shift'].map(name => [name, key()])),
        addCapture() {}, resetKeys() { keys.forEach(value => value.reset()); }
    } });
}

// Real create/init and restart routing use the selected hero, with no upgraded state reused.
for (const characterId of ['llamaCrunch', 'candy']) {
    const { game: g } = fixture();
    g.events.emit('shutdown'); // Remove the fixture's initial scene before a fresh create.
    installKeyboard(g);
    g.init({ characterId }); g.create();
    assert.equal(g.run.characterId, characterId);
    assert.equal(g.run.health, CHARACTERS[characterId].health);
    assert.equal(g.run.weapon.id, CHARACTERS[characterId].startingWeapon);
    applyUpgrade(g.run, 'power'); g.endGame(); g.restartRun();
    assert.equal(JSON.stringify(g.transitions.at(-1)), JSON.stringify(['restart', { characterId }]));
    const data = g.transitions.at(-1)[1];
    g.events.emit('shutdown'); g.init(data); g.create();
    assert.equal(g.run.characterId, characterId); assert.equal(g.run.weapon.damage, WEAPONS[CHARACTERS[characterId].startingWeapon].damage);
    g.endGame(); g.returnToMenu();
    assert.equal(JSON.stringify(g.transitions.at(-1)), JSON.stringify(['start', 'MainMenu', undefined]));
    g.events.emit('shutdown');
    g.init({ characterId: '__proto__' }); assert.equal(g.selectedCharacter, 'llamaCrunch');
}

// Selection supports pointer, arrow/confirm, direct number keys, back and duplicate-start guarding.
const { CharacterSelect } = load('scenes/CharacterSelect');
for (const method of ['pointer', 'keyboard', 'direct']) {
    const { game: host, objects } = fixture();
    const select = new CharacterSelect();
    Object.assign(select, { add: host.add, cameras: host.cameras, scene: host.scene });
    installKeyboard(select); select.create();
    if (method === 'pointer') {
        const cards = objects.filter(object => object.kind === 'rectangle' && object.eventNames().includes('pointerdown'));
        cards[1].emit('pointerdown');
    } else if (method === 'keyboard') {
        select.keys.RIGHT._justDown = true; select.update();
        select.keys.ENTER._justDown = true; select.update();
    } else { select.keys.TWO._justDown = true; select.update(); }
    assert.equal(JSON.stringify(host.transitions.at(-1)), JSON.stringify(['start', 'Game', { characterId: 'candy' }]));
    const count = host.transitions.length; select.startRun(0);
    assert.equal(host.transitions.length, count);
    select.create(); // Returning to the screen allows a fresh choice.
    select.keys.ONE._justDown = true; select.update();
    assert.equal(host.transitions.at(-1)[2].characterId, 'llamaCrunch');
    select.create(); orientation.matches = true; select.startRun(1); orientation.matches = false;
    assert.equal(select.starting, false);
    select.keys.ESC._justDown = true; select.update();
    assert.equal(host.transitions.at(-1)[1], 'MainMenu');
    host.events.emit('shutdown');
}
console.log('PASS selection: mouse/touch cards, keyboard navigation/direct choice, duplicate-start guard, real scene initialization, same-character restarts, menu return and re-selection.');

// Focused weapon balance: sector hits every eligible enemy exactly once per swing.
{
    const { game: g, advance } = fixture('llamaCrunch');
    assert.equal(g.run.weapon.id, 'swordSlash');
    assert.equal(WEAPONS.swordSlash.name, 'Sword Slash');
    assert.equal(g.run.weapon.damage, 2);
    assert.equal(g.run.weapon.cooldown, 500);
    assert.equal(g.run.weapon.range, 115);
    const positions = [
        [30, 0, true], [80, 30, true], [50, -40, true],
        [-10, 0, false], [10, 40, false], [116, 0, false], [100, 60, false]
    ];
    const enemies = positions.map(([dx, dy]) => {
        g.enemySystem.spawnBread(WORLD.enemyStartX + g.enemySystem.enemies.length * WORLD.enemySpacing);
        const enemy = g.enemySystem.enemies.at(-1);
        enemy.sprite.x = g.player.x + dx; enemy.sprite.y = g.player.y + dy; enemy.hp = 7;
        return enemy;
    });
    g.combatSystem.attack();
    const firstSlash = [...g.combatSystem.slashes][0];
    assert.ok(firstSlash.children.some(child => child.kind === 'graphics'));
    positions.forEach(([, , hit], index) => assert.equal(enemies[index].hp, hit ? 5 : 7));
    // Neither holding attack within the cooldown nor updating the visual causes another hit.
    for (const elapsed of [0.016, 0.100, 0.300, 0.499]) {
        g.run.runTime = elapsed;
        g.combatSystem.attack(); g.combatSystem.update(0.016);
        positions.forEach(([, , hit], index) => assert.equal(enemies[index].hp, hit ? 5 : 7));
    }
    assert.equal(g.combatSystem.slashes.size, 1);
    advance(170); assert.equal(firstSlash.active, false);
    g.run.runTime = 0.500; g.combatSystem.attack();
    positions.forEach(([, , hit], index) => assert.equal(enemies[index].hp, hit ? 3 : 7));
    g.events.emit('shutdown');
    assert.equal(g.combatSystem.slashes.size, 0);
}

// Multi-kill sword swings award one gem per enemy and feed the unchanged XP/upgrade flow.
{
    const { game: g } = fixture('llamaCrunch');
    for (const dx of [25, 35, 45]) {
        g.enemySystem.spawnBread(WORLD.enemyStartX + g.enemySystem.enemies.length * WORLD.enemySpacing);
        const enemy = g.enemySystem.enemies.at(-1);
        enemy.sprite.x = g.player.x + dx; enemy.sprite.y = g.player.y; enemy.hp = 2;
    }
    g.combatSystem.attack();
    assert.equal(g.run.kills, 3); assert.equal(g.enemySystem.enemies.length, 0);
    assert.equal(g.xpSystem.gems.length, 3);
    for (let frame = 0; frame < 20 && g.run.phase === 'playing'; frame++) g.xpSystem.update(0.05);
    assert.equal(g.run.level, 2); assert.equal(g.run.phase, 'choosingUpgrade');
    g.chooseUpgrade(0); assert.equal(g.run.weapon.damage, 3);
    g.enemySystem.spawnBread(WORLD.enemyStartX + WORLD.enemySpacing * 3);
    const enemy = g.enemySystem.enemies[0];
    enemy.sprite.x = g.player.x + 50; enemy.sprite.y = g.player.y; enemy.hp = 3;
    g.run.runTime = 0.5; g.combatSystem.attack();
    assert.equal(g.run.kills, 4);
}

// Candy retains one projectile per attack and exactly one enemy hit per projectile.
{
    const { game: g } = fixture('candy');
    assert.equal(g.run.weapon.damage, 1); assert.equal(g.run.weapon.cooldown, 900);
    for (let i = 0; i < 3; i++) {
        g.enemySystem.spawnBread(WORLD.enemyStartX + g.enemySystem.enemies.length * WORLD.enemySpacing);
        const enemy = g.enemySystem.enemies.at(-1);
        enemy.sprite.x = g.player.x + 90; enemy.sprite.y = g.player.y; enemy.hp = 4;
    }
    g.combatSystem.attack(); assert.equal(g.combatSystem.projectiles.length, 1);
    const shot = g.combatSystem.projectiles[0];
    g.combatSystem.update(0.1);
    assert.equal(shot.sprite.active, false); assert.equal(g.combatSystem.projectiles.length, 0);
    assert.equal(g.enemySystem.enemies.filter(enemy => enemy.hp === 3).length, 1);
    assert.equal(g.enemySystem.enemies.filter(enemy => enemy.hp === 4).length, 2);
    g.run.runTime = 0.899; g.combatSystem.attack(); assert.equal(g.combatSystem.projectiles.length, 0);
    g.run.runTime = 0.900; g.combatSystem.attack(); assert.equal(g.combatSystem.projectiles.length, 1);
}
console.log('PASS focused balance: 2-damage/500 ms forward sword sector, multi-target single-hit swings, cooldown boundaries, multi-kill XP/upgrades, and 1-damage/900 ms non-piercing Candy shots.');

// Optional sprite sheets never replace a working placeholder with invalid frames.
const { CHARACTER_SPRITES, hasCharacterSheet, loadCharacterSheets, registerCharacterAnimations } = load('characters/spriteAnimations');
function installCharacterSprites(scene, width, height, missingFrame) {
    const animations = new Map();
    const pack = CHARACTER_SPRITES.llama;
    const { animationSource } = load('rendering/spriteAssets');
    const sources = new Map();
    for (const state of Object.keys(pack.animations)) {
        const source = animationSource(pack, state);
        sources.set(source.key, source);
        const fallback = pack.animations[state].fallback;
        if (fallback) sources.set(fallback.sheet.key, fallback.sheet);
    }
    scene.textures = {
        exists: key => sources.has(key),
        get: key => {
            const source = sources.get(key);
            return { getSourceImage: () => ({ width: width ?? source.width, height: height ?? source.height }),
                has: name => Number(name) !== missingFrame && Number(name) >= 0 &&
                    Number(name) < source.width / 256 * (source.height / 256),
                get: () => ({ width: 256, height: 256 }) };
        }
    };
    scene.anims = {
        exists: key => animations.has(key),
        create: animation => animations.set(animation.key, animation),
        generateFrameNumbers: (key, config) => Array.from({ length: config.end - config.start + 1 }, (_, index) => ({ key, frame: config.start + index }))
    };
    scene.add.sprite = (x, y, key, frame) => {
        const sprite = scene.add.image(x, y, key, frame);
        sprite.plays = [];
        sprite.setFlipX = value => { sprite.flipX = value; return sprite; };
        sprite.setOrigin = (ox, oy) => { sprite.originX = ox; sprite.originY = oy; return sprite; };
        sprite.setScale = scale => { sprite.scale = scale; return sprite; };
        sprite.anims = {
            isPlaying: false, paused: false,
            pause() { if (!this.paused) { this.wasPlaying = this.isPlaying; this.isPlaying = false; this.paused = true; } },
            resume() { if (this.paused) { this.isPlaying = this.wasPlaying; this.paused = false; } }
        };
        sprite.play = name => {
            sprite.plays.push(name); sprite.animationKey = name;
            sprite.textureKey = animations.get(name).frames[0].key;
            sprite.anims.paused = false; sprite.anims.isPlaying = true;
            return sprite;
        };
        return sprite;
    };
    return animations;
}
{
    const { game: g } = fixture();
    const queued = [];
    g.load = { spritesheet: (...args) => queued.push(args) };
    loadCharacterSheets(g);
    assert.equal(queued.length, 4);
    const queuedByKey = new Map(queued.map(entry => [entry[0], entry]));
    for (const [key, file, end] of [
        ['llama-crunch-idle', 'idle.png', 3], ['llama-crunch-run', 'run.png', 5],
        ['llama-crunch-attack', 'attack.png', 4], ['llama-crunch', 'llama-crunch-9x3-256-import-test.png', 26]
    ]) {
        const entry = queuedByKey.get(key);
        assert.equal(entry[1], `characters/llama-crunch/${file}`);
        assert.equal(entry[2].frameWidth, 256); assert.equal(entry[2].frameHeight, 256);
        assert.equal(entry[2].startFrame, 0); assert.equal(entry[2].endFrame, end);
    }
    let animations = installCharacterSprites(g, 2172, 724);
    registerCharacterAnimations(g);
    assert.equal(animations.size, 0); assert.equal(hasCharacterSheet(g, CHARACTER_SPRITES.llama), false);
    const wrongSize = new Player(g, g.run, g.groundY);
    assert.equal(wrongSize.sprite.children.length, 7);
    animations = installCharacterSprites(g, 2304, 768, 26);
    registerCharacterAnimations(g); assert.equal(animations.size, 0);
    assert.equal(new Player(g, g.run, g.groundY).sprite.children.length, 7);
    animations = installCharacterSprites(g);
    registerCharacterAnimations(g); registerCharacterAnimations(g);
    assert.equal(animations.size, 7);
    for (const [name, start, end, fps, repeat] of [
        ['idle', 0, 3, 6, -1], ['run', 0, 5, 10, -1], ['jump', 10, 12, 12, 0],
        ['fall', 13, 14, 10, 0], ['attack', 0, 4, 30, 0], ['hurt', 19, 21, 18, 0], ['death', 22, 26, 10, 0]
    ]) {
        const animation = animations.get(`llama-crunch:${name}`);
        assert.equal(animation.frames[0].frame, start); assert.equal(animation.frames.at(-1).frame, end);
        assert.equal(animation.frameRate, fps); assert.equal(animation.repeat, repeat);
    }
    g.events.emit('shutdown');
}

// Animation states and priorities are presentation-only; the container remains the anchor.
{
    const { game: g } = fixture();
    installCharacterSprites(g); registerCharacterAnimations(g);
    const player = new Player(g, g.run, g.groundY);
    const sprite = player.sprite.children[0];
    assert.equal(sprite.animationKey, 'llama-crunch:idle');
    assert.equal(player.sprite.children.length, 1);
    assert.equal(sprite.originX, 0.5); assert.equal(sprite.originY, 0.875);
    assert.equal(sprite.scale, 0.5); assert.equal(sprite.x, 0); assert.equal(sprite.y, 40);
    const x = player.x;
    player.update({ left: false, right: true, jump: false }, 0.05);
    assert.equal(player.x, x + 14); assert.equal(sprite.animationKey, 'llama-crunch:run');
    player.update({ left: false, right: false, jump: true }, 0.05);
    assert.equal(sprite.animationKey, 'llama-crunch:jump');
    g.run.velocityY = 20;
    player.update({ left: false, right: false, jump: false }, 0.01);
    assert.equal(sprite.animationKey, 'llama-crunch:fall');
    player.showAttack(); assert.equal(sprite.animationKey, 'llama-crunch:attack');
    player.showHurt(); assert.equal(sprite.animationKey, 'llama-crunch:hurt');
    player.showAttack(); assert.equal(sprite.animationKey, 'llama-crunch:hurt');
    const state = JSON.stringify(g.run);
    player.setVisualPhase('choosingUpgrade'); assert.equal(sprite.anims.paused, true);
    player.setVisualPhase('playing'); assert.equal(sprite.anims.isPlaying, true);
    assert.equal(JSON.stringify(g.run), state);
    sprite.anims.isPlaying = false;
    player.update({ left: false, right: false, jump: false }, 0.01);
    assert.equal(sprite.animationKey, 'llama-crunch:fall');
    player.showDeath(); assert.equal(sprite.animationKey, 'llama-crunch:death');
    sprite.anims.isPlaying = false;
    player.showHurt(); player.showAttack();
    assert.equal(sprite.animationKey, 'llama-crunch:death');
    const plays = sprite.plays.length;
    player.update({ left: false, right: false, jump: false }, 0.01);
    assert.equal(sprite.plays.length, plays); // Hold the final death frame without restarting it.
    const fresh = new Player(g, createRunState(), g.groundY);
    assert.equal(fresh.sprite.children[0].animationKey, 'llama-crunch:idle');
    assert.equal(new Player(g, createRunState('candy'), g.groundY).sprite.children.length, 11);
    g.events.emit('shutdown');
}

// Scale/origin/offset adjustments do not change movement or any run-state field.
{
    const { game: g } = fixture();
    installCharacterSprites(g); registerCharacterAnimations(g);
    const config = CHARACTER_SPRITES.llama;
    const original = { scale: config.scale, originX: config.originX, originY: config.originY, offsetX: config.offsetX, offsetY: config.offsetY };
    try {
        Object.assign(config, { scale: 0.8, originX: 0.3, originY: 0.9, offsetX: 25, offsetY: 35 });
        const state = createRunState(); const snapshot = JSON.stringify(state);
        const player = new Player(g, state, g.groundY);
        assert.equal(player.x, 170); assert.equal(player.y, g.groundY - 40);
        assert.equal(player.sprite.children[0].scale, 0.8);
        assert.equal(player.sprite.children[0].x, 25); assert.equal(player.sprite.children[0].y, 35);
        assert.equal(JSON.stringify(state), snapshot);
        player.update({ left: true, right: false, jump: false }, 0.05);
        assert.equal(player.x, 156);
    } finally { Object.assign(config, original); }
    g.events.emit('shutdown');
}

// Only accepted attacks and damage events trigger poses; death does not delay the phase.
{
    const { game: g } = fixture();
    installCharacterSprites(g); registerCharacterAnimations(g);
    g.player = new Player(g, g.run, g.groundY);
    g.combatSystem = new CombatSystem(g, g.run, g.player, g.enemySystem,
        (x, y) => g.xpSystem.dropGem(x, y), () => g.endGame(), () => g.updateHud());
    const sprite = g.player.sprite.children[0];
    g.combatSystem.attack(); assert.equal(sprite.animationKey, 'llama-crunch:attack');
    const plays = sprite.plays.length;
    g.combatSystem.attack(); assert.equal(sprite.plays.length, plays);
    g.enemySystem.spawnBread(); const enemy = g.enemySystem.enemies[0];
    enemy.sprite.x = g.player.x; enemy.sprite.y = g.player.y;
    g.combatSystem.checkContact(enemy); assert.equal(sprite.animationKey, 'llama-crunch:hurt');
    g.run.health = 1; g.run.runTime = 1;
    g.combatSystem.checkContact(enemy);
    assert.equal(g.run.phase, 'gameOver'); assert.equal(sprite.animationKey, 'llama-crunch:death');
    g.setPauseReason('portrait', true);
    assert.equal(g.run.phase, 'gameOver'); assert.equal(sprite.anims.paused, true);
    g.setPauseReason('portrait', false);
    assert.equal(sprite.anims.paused, false); assert.equal(sprite.animationKey, 'llama-crunch:death');
    g.events.emit('shutdown');
}
console.log('PASS sprite integration: exact sheet/frame validation, animation mapping, fallback, priorities, phase pause, combat hooks, Candy preservation and visual-only transforms.');

// Validate the actual deployed PNG, rather than relying only on mock textures.
{
    const { inflateSync } = require('node:zlib');
    const { animationSource } = load('rendering/spriteAssets');
    const pack = CHARACTER_SPRITES.llama;
    const sources = new Map(Object.keys(pack.animations).map(state => {
        const source = animationSource(pack, state); return [source.key, source];
    }));
    const slashEffect = load('weapons/slashEffect').SWORD_SLASH_EFFECT;
    sources.set(slashEffect.key, slashEffect);
    for (const sheet of sources.values()) {
        const file = path.join(__dirname, '../public/assets', sheet.path);
        assert.ok(fs.existsSync(file), `Configured character asset missing: ${file}`);
        const png = fs.readFileSync(file);
        assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
        const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
        assert.equal(width, sheet.width); assert.equal(height, sheet.height);
        assert.equal(width % 256, 0); assert.equal(height % 256, 0);
        assert.equal(png[24], 8); assert.equal(png[25], 6); assert.equal(png[28], 0);
        const chunks = [];
        for (let cursor = 8; cursor < png.length;) {
            const length = png.readUInt32BE(cursor);
            if (png.subarray(cursor + 4, cursor + 8).toString() === 'IDAT') chunks.push(png.subarray(cursor + 8, cursor + 8 + length));
            cursor += length + 12;
        }
        const raw = inflateSync(Buffer.concat(chunks));
        const stride = width * 4;
        assert.equal(raw.length, (stride + 1) * height);
        let previous = Buffer.alloc(stride), cursor = 0, transparent = 0, visible = 0;
        for (let y = 0; y < height; y++) {
            const filter = raw[cursor++];
            assert.ok(filter <= 4);
            const row = Buffer.from(raw.subarray(cursor, cursor + stride)); cursor += stride;
            for (let x = 0; x < stride; x++) {
                const left = x >= 4 ? row[x - 4] : 0, up = previous[x], diagonal = x >= 4 ? previous[x - 4] : 0;
                let predictor = 0;
                if (filter === 1) predictor = left;
                else if (filter === 2) predictor = up;
                else if (filter === 3) predictor = Math.floor((left + up) / 2);
                else if (filter === 4) {
                    const value = left + up - diagonal;
                    const a = Math.abs(value - left), b = Math.abs(value - up), c = Math.abs(value - diagonal);
                    predictor = a <= b && a <= c ? left : b <= c ? up : diagonal;
                }
                row[x] = (row[x] + predictor) & 255;
            }
            for (let x = 3; x < stride; x += 4) { if (row[x] === 0) transparent++; else visible++; }
            previous = row;
        }
        assert.ok(transparent > 0, 'Character PNG must contain transparent pixels');
        assert.ok(visible > 0, 'Character PNG must not be completely blank');
        console.log(`PASS actual asset: ${width} x ${height}, ${(width / 256) * (height / 256)} cells, RGBA transparency (${transparent} transparent pixels), configured path exists.`);
    }
}

// Preferred separate-state packs switch textures without changing the parent/gameplay state.
{
    const { game: g } = fixture();
    const combined = CHARACTER_SPRITES.llama;
    const animations = installCharacterSprites(g);
    const states = ['idle', 'run', 'jump', 'fall', 'attack', 'hurt', 'death'];
    const pack = {
        format: 'separate', key: 'llama-crunch', scale: combined.scale,
        originX: combined.originX, originY: combined.originY, offsetX: combined.offsetX, offsetY: combined.offsetY,
        animations: Object.fromEntries(states.map(state => {
            const original = combined.animations[state];
            const count = original.end - original.start + 1;
            return [state, { start: 0, end: count - 1, fps: original.fps, repeat: original.repeat,
                sheet: { key: `llama-crunch-sheet:${state}`, path: `characters/llama-crunch/${state}.png`,
                    width: count * 256, height: 256, frameWidth: 256, frameHeight: 256 } }];
        }))
    };
    let missing;
    g.textures = {
        exists: key => states.some(state => pack.animations[state].sheet.key === key && state !== missing),
        get: key => {
            const state = states.find(name => pack.animations[name].sheet.key === key);
            const clip = pack.animations[state];
            return { getSourceImage: () => ({ width: clip.sheet.width, height: clip.sheet.height }),
                has: name => Number(name) >= 0 && Number(name) <= clip.end,
                get: () => ({ width: 256, height: 256 }) };
        }
    };
    CHARACTER_SPRITES.llama = pack;
    try {
        const queued = [];
        g.load = { spritesheet: (...args) => queued.push(args) };
        loadCharacterSheets(g);
        assert.equal(queued.length, 7);
        assert.equal(new Set(queued.map(args => args[0])).size, 7);
        registerCharacterAnimations(g);
        assert.equal(animations.size, 7);
        for (const state of states) {
            const animation = animations.get(`llama-crunch:${state}`);
            assert.equal(animation.frames[0].key, pack.animations[state].sheet.key);
            assert.equal(animation.frames[0].frame, 0);
            assert.equal(animation.frames.at(-1).frame, pack.animations[state].end);
        }
        const player = new Player(g, g.run, g.groundY);
        const sprite = player.sprite.children[0];
        const check = state => {
            assert.equal(sprite.textureKey, pack.animations[state].sheet.key);
            assert.equal(sprite.scale, 0.5); assert.equal(sprite.originY, 0.875);
            assert.equal(sprite.x, 0); assert.equal(sprite.y, 40);
        };
        check('idle');
        player.update({ left: false, right: true, jump: false }, 0.05); check('run');
        player.update({ left: false, right: false, jump: true }, 0.05); check('jump');
        g.run.velocityY = 10;
        player.update({ left: false, right: false, jump: false }, 0.01); check('fall');
        player.showAttack(); check('attack'); player.showHurt(); check('hurt'); player.showDeath(); check('death');
        assert.equal(player.x, 184); // Same 280 px/s movement, independent of texture changes.
        missing = 'fall';
        assert.equal(hasCharacterSheet(g, pack), false);
        assert.equal(new Player(g, g.run, g.groundY).sprite.children.length, 7);
        missing = undefined;
        pack.animations.idle.sheet.frameWidth = 128;
        assert.equal(hasCharacterSheet(g, pack), false);
        pack.animations.idle.sheet.frameWidth = 256;
        pack.animations.idle.end = 999;
        assert.equal(hasCharacterSheet(g, pack), false);
        pack.animations.idle.end = combined.animations.idle.end;
        const jump = pack.animations.jump;
        delete pack.animations.jump;
        assert.equal(hasCharacterSheet(g, pack), false);
        pack.animations.jump = jump;
        assert.equal(hasCharacterSheet(g, pack), true);
    } finally { CHARACTER_SPRITES.llama = combined; }
    g.events.emit('shutdown');
}
console.log('PASS visual contract: separate state textures, seven-state completeness, 256-pixel enforcement, invalid-range rejection, legacy support and unchanged gameplay anchors.');

// Shared facing persists through idle, opposite inputs, airborne/action states and flips only art.
{
    const { game: g } = fixture();
    installCharacterSprites(g); registerCharacterAnimations(g);
    const player = new Player(g, g.run, g.groundY);
    const art = player.sprite.children[0];
    assert.equal(player.facing, 1);
    const transform = [art.x, art.y, art.originX, art.originY, art.scale];
    player.update({ left: true, right: false, jump: false }, 0.05);
    assert.equal(player.facing, -1); assert.equal(art.flipX, true);
    assert.equal(player.x, 156); assert.equal(player.sprite.scaleX, 1);
    player.update({ left: false, right: false, jump: false }, 0.05);
    assert.equal(player.facing, -1); assert.equal(art.flipX, true);
    player.update({ left: true, right: true, jump: false }, 0.05);
    assert.equal(player.facing, -1); assert.equal(player.x, 156);
    player.update({ left: false, right: false, jump: true }, 0.05);
    assert.equal(art.animationKey, 'llama-crunch:jump'); assert.equal(art.flipX, true);
    g.run.velocityY = 10;
    player.update({ left: false, right: false, jump: false }, 0.01);
    assert.equal(art.animationKey, 'llama-crunch:fall'); assert.equal(art.flipX, true);
    player.showAttack(); assert.equal(art.animationKey, 'llama-crunch:attack'); assert.equal(art.flipX, true);
    player.showHurt(); assert.equal(art.animationKey, 'llama-crunch:hurt'); assert.equal(art.flipX, true);
    player.update({ left: false, right: true, jump: false }, 0.01);
    assert.equal(player.facing, 1); assert.equal(art.flipX, false);
    player.showDeath(); assert.equal(art.animationKey, 'llama-crunch:death'); assert.equal(art.flipX, false);
    assert.equal(JSON.stringify([art.x, art.y, art.originX, art.originY, art.scale]), JSON.stringify(transform));
    assert.equal(player.sprite.flipX, undefined); assert.equal(player.sprite.scaleX, 1);
    assert.equal(new Player(g, createRunState(), g.groundY).facing, 1);
}
for (const characterId of ['llamaCrunch', 'candy']) {
    const { game: g } = fixture(characterId); // Both shape-based fallbacks use the same method.
    const player = new Player(g, g.run, g.groundY);
    const original = player.sprite.children.map(part => [part.x, part.scaleX]);
    player.update({ left: true, right: false, jump: false }, 0.05);
    player.sprite.children.forEach((part, index) => {
        assert.equal(part.x, -original[index][0]); assert.equal(part.scaleX, -original[index][1]);
    });
    player.update({ left: false, right: false, jump: false }, 0.05);
    assert.equal(player.facing, -1); assert.equal(player.sprite.scaleX, 1);
    player.showAttack(); player.showHurt(); player.showDeath();
    assert.equal(player.facing, -1);
    player.update({ left: false, right: true, jump: false }, 0.05);
    player.sprite.children.forEach((part, index) => {
        assert.equal(part.x, original[index][0]); assert.equal(part.scaleX, original[index][1]);
    });
    assert.equal(player.facing, 1); assert.equal(player.sprite.scaleX, 1);
}

// Flipping with a custom origin/offset preserves the configured anchor exactly.
{
    const { game: g } = fixture(); installCharacterSprites(g); registerCharacterAnimations(g);
    const config = CHARACTER_SPRITES.llama;
    const original = { originX: config.originX, offsetX: config.offsetX };
    try {
        config.originX = 0.3; config.offsetX = 17;
        const player = new Player(g, g.run, g.groundY), art = player.sprite.children[0];
        player.update({ left: true, right: false, jump: false }, 0);
        assert.equal(player.x, 170); assert.equal(player.y, g.groundY - 40);
        assert.equal(art.flipX, true); assert.equal(art.originX, 0.3); assert.equal(art.x, 17);
        player.update({ left: false, right: true, jump: false }, 0);
        assert.equal(art.flipX, false); assert.equal(art.originX, 0.3); assert.equal(art.x, 17);
    } finally { Object.assign(config, original); }
}

// Sword aims in facing direction without flipping/scaling the effect container or changing damage.
{
    const { game: g } = fixture(); g.player.facing = -1;
    const enemies = [-40, -80, 40].map(dx => {
        g.enemySystem.spawnBread(WORLD.enemyStartX + g.enemySystem.enemies.length * WORLD.enemySpacing); const enemy = g.enemySystem.enemies.at(-1);
        enemy.sprite.x = g.player.x + dx; enemy.sprite.y = g.player.y; enemy.hp = 7;
        return enemy;
    });
    g.combatSystem.attack();
    assert.equal(enemies[0].hp, 5); assert.equal(enemies[1].hp, 5); assert.equal(enemies[2].hp, 7);
    const slash = [...g.combatSystem.slashes][0];
    assert.equal(slash.scaleX, 1); assert.equal(slash.flipX, undefined);
    assert.ok(slash.children.filter(part => part.kind === 'rectangle').every(part => part.x < 0));
    g.run.runTime = 0.499; g.combatSystem.attack(); assert.equal(enemies[0].hp, 5);
    g.run.runTime = 0.5; g.combatSystem.attack(); assert.equal(enemies[0].hp, 3);
    g.events.emit('shutdown');
}

// A shot keeps its firing direction after turning and hits only the nearest enemy on that path.
{
    const { game: g } = fixture('candy'); g.player.facing = -1;
    for (const x of [100, 160, 450]) {
        g.enemySystem.spawnBread(WORLD.enemyStartX + g.enemySystem.enemies.length * WORLD.enemySpacing); const enemy = g.enemySystem.enemies.at(-1);
        enemy.sprite.x = x; enemy.sprite.y = g.player.y;
    }
    g.combatSystem.attack(); const shot = g.combatSystem.projectiles[0];
    assert.equal(shot.sprite.x, 270); assert.equal(shot.direction, -1); assert.equal(shot.sprite.scaleX, 1);
    g.player.facing = 1;
    g.combatSystem.update(0.5);
    assert.equal(g.run.kills, 1); assert.equal(shot.sprite.active, false);
    assert.equal(g.enemySystem.enemies[0].sprite.x, 100); assert.equal(g.enemySystem.enemies[1].sprite.x, 450);
    g.run.runTime = 0.9; g.combatSystem.attack();
    const next = g.combatSystem.projectiles[0]; assert.equal(next.direction, 1); assert.equal(next.sprite.x, 330);
    g.player.facing = -1; g.combatSystem.update(0.3);
    assert.equal(g.run.kills, 2); assert.equal(g.xpSystem.gems.length, 2);
    g.run.runTime = 1.8; g.combatSystem.attack();
    g.combatSystem.update(1);
    assert.equal(g.combatSystem.projectiles.length, 0);
    g.events.emit('shutdown');
}
console.log('PASS facing: animated and placeholder art, retained idle/airborne/action direction, stable origins/anchors, directional sword/projectiles, unchanged damage/cooldowns and unflipped effects.');

// Mixed packs prefer the corrected strips independently, with per-state legacy fallback.
{
    const { game: g } = fixture();
    const animations = installCharacterSprites(g);
    const { resolveCharacterAnimation } = load('characters/spriteAnimations');
    registerCharacterAnimations(g);
    for (const [state, key, start, end] of [
        ['idle', 'llama-crunch-idle', 0, 3], ['run', 'llama-crunch-run', 0, 5],
        ['attack', 'llama-crunch-attack', 0, 4], ['jump', 'llama-crunch', 10, 12],
        ['fall', 'llama-crunch', 13, 14], ['hurt', 'llama-crunch', 19, 21], ['death', 'llama-crunch', 22, 26]
    ]) {
        const clip = animations.get(`llama-crunch:${state}`);
        assert.equal(clip.frames[0].key, key); assert.equal(clip.frames[0].frame, start);
        assert.equal(clip.frames.at(-1).frame, end);
    }
    const exists = g.textures.exists;
    g.textures.exists = key => key !== 'llama-crunch-run' && exists(key);
    assert.equal(hasCharacterSheet(g, CHARACTER_SPRITES.llama), true);
    assert.equal(resolveCharacterAnimation(g, CHARACTER_SPRITES.llama, 'run').source.key, 'llama-crunch');
    assert.equal(resolveCharacterAnimation(g, CHARACTER_SPRITES.llama, 'idle').source.key, 'llama-crunch-idle');
    animations.clear(); registerCharacterAnimations(g);
    const run = animations.get('llama-crunch:run');
    assert.equal(run.frames[0].key, 'llama-crunch'); assert.equal(run.frames[0].frame, 4);
    assert.equal(run.frames.at(-1).frame, 9);
    g.textures.exists = key => key !== 'llama-crunch-run' && key !== 'llama-crunch' && exists(key);
    assert.equal(hasCharacterSheet(g, CHARACTER_SPRITES.llama), false);
    assert.equal(new Player(g, g.run, g.groundY).sprite.children.length, 7);
    g.events.emit('shutdown');
}

// Baked attack effects suppress only the duplicate drawing, never the hit or cooldown.
for (const useLegacyAttack of [false, true]) {
    const { game: g } = fixture();
    const animations = installCharacterSprites(g);
    if (useLegacyAttack) {
        const exists = g.textures.exists;
        g.textures.exists = key => key !== 'llama-crunch-attack' && exists(key);
    }
    registerCharacterAnimations(g);
    g.player = new Player(g, g.run, g.groundY);
    const art = g.player.sprite.children[0];
    g.combatSystem = new CombatSystem(g, g.run, g.player, g.enemySystem,
        (x, y) => g.xpSystem.dropGem(x, y), () => g.endGame(), () => g.updateHud());
    g.enemySystem.spawnBread();
    const enemy = g.enemySystem.enemies[0];
    enemy.sprite.x = g.player.x + 40; enemy.sprite.y = g.player.y; enemy.hp = 7;
    g.combatSystem.attack();
    assert.equal(enemy.hp, 5);
    assert.equal(g.combatSystem.slashes.size, useLegacyAttack ? 1 : 0);
    assert.equal(animations.get('llama-crunch:attack').frames[0].key, useLegacyAttack ? 'llama-crunch' : 'llama-crunch-attack');
    g.run.runTime = 0.499; g.combatSystem.attack(); assert.equal(enemy.hp, 5);
    g.run.runTime = 0.5; g.combatSystem.attack(); assert.equal(enemy.hp, 3);
    g.player.update({ left: true, right: false, jump: false }, 0.01);
    assert.equal(art.flipX, true);
    g.run.runTime = 1; enemy.sprite.x = g.player.x - 40; g.combatSystem.attack();
    assert.equal(enemy.hp, 1); assert.equal(art.flipX, true);
    g.events.emit('shutdown');
}
console.log('PASS corrected strips: active mixed sources, per-state combined fallback, retained flipping, baked slash suppression and identical damage/cooldowns.');

function installSlashEffect(scene) {
    const animations = installCharacterSprites(scene);
    const { SWORD_SLASH_EFFECT: effect, registerWeaponEffects } = load('weapons/slashEffect');
    const exists = scene.textures.exists, get = scene.textures.get;
    scene.textures.exists = key => key === effect.key || exists(key);
    scene.textures.get = key => key === effect.key ? {
        getSourceImage: () => ({ width: 1280, height: 256 }),
        has: frame => Number(frame) >= 0 && Number(frame) <= 4,
        get: () => ({ width: 256, height: 256 })
    } : get(key);
    registerCharacterAnimations(scene); registerWeaponEffects(scene);
    return { animations, effect };
}

// External sword effect: five frames once, uniform range scaling and exact pause/cleanup.
{
    const { game: g } = fixture();
    const { animations, effect } = installSlashEffect(g);
    const { loadWeaponEffects } = load('weapons/slashEffect');
    const queued = []; g.load = { spritesheet: (...args) => queued.push(args) }; loadWeaponEffects(g);
    assert.equal(queued[0][1], 'weapons/sword-slash/effect.png');
    assert.equal(queued[0][2].frameWidth, 256); assert.equal(queued[0][2].frameHeight, 256);
    assert.equal(queued[0][2].startFrame, 0); assert.equal(queued[0][2].endFrame, 4);
    const animation = animations.get(effect.animationKey);
    assert.equal(JSON.stringify(animation.frames.map(frame => frame.frame)), JSON.stringify([0, 1, 2, 3, 4]));
    assert.equal(animation.frameRate, 18); assert.equal(animation.repeat, 0);
    g.player = new Player(g, g.run, g.groundY);
    g.combatSystem = new CombatSystem(g, g.run, g.player, g.enemySystem,
        (x, y) => g.xpSystem.dropGem(x, y), () => g.endGame(), () => g.updateHud());
    const character = g.player.sprite.children[0];
    g.enemySystem.spawnBread(); const enemy = g.enemySystem.enemies[0];
    enemy.hp = 7; enemy.sprite.x = g.player.x + 50; enemy.sprite.y = g.player.y;
    g.combatSystem.attack();
    assert.equal(enemy.hp, 5); assert.equal(g.combatSystem.slashes.size, 1);
    assert.equal(character.animationKey, 'llama-crunch:attack'); // Character pose and external effect start together.
    assert.equal(animations.get(character.animationKey).frames.length, 5);
    const slash = [...g.combatSystem.slashes][0];
    assert.equal(slash.animationKey, effect.animationKey); assert.equal(slash.flipX, false);
    assert.equal(slash.x, g.player.x + 115 / 2); assert.equal(slash.y, g.player.y);
    assert.equal(slash.scale, 115 / 256); assert.equal(slash.originX, 0.5); assert.equal(slash.originY, 0.5);
    g.run.xp = 3; g.xpSystem.checkLevelUp();
    assert.equal(slash.anims.paused, true); assert.equal(character.anims.paused, true);
    g.chooseUpgrade(0); assert.equal(slash.anims.paused, false); assert.equal(character.anims.paused, false);
    g.setPauseReason('portrait', true); assert.equal(slash.anims.paused, true);
    g.setPauseReason('portrait', false); assert.equal(slash.anims.paused, false);
    slash.emit('animationcomplete');
    assert.equal(slash.active, false); assert.equal(g.combatSystem.slashes.size, 0);
    // Range upgrades affect only the next effect's footprint, not the paused existing swing.
    applyUpgrade(g.run, 'range');
    g.player.update({ left: true, right: false, jump: false }, 0.01);
    enemy.sprite.x = g.player.x - 50;
    g.run.runTime = 0.5; g.combatSystem.attack();
    assert.equal(enemy.hp, 2); // +1 damage from the level-up choice, unchanged upgrade behaviour.
    const left = [...g.combatSystem.slashes][0];
    assert.equal(left.flipX, true); assert.equal(left.x, g.player.x - 135 / 2);
    assert.equal(character.flipX, true); assert.equal(character.animationKey, 'llama-crunch:attack');
    assert.equal(left.scale, 135 / 256);
    g.run.runTime = 0.999; g.combatSystem.attack(); assert.equal(g.combatSystem.slashes.size, 1);
    g.endGame(); assert.equal(left.active, false); assert.equal(g.combatSystem.slashes.size, 0);
    g.events.emit('shutdown');
}

// Restart removes an in-flight animation and its completion listener.
{
    const { game: g } = fixture(); installSlashEffect(g);
    g.combatSystem.attack(); const slash = [...g.combatSystem.slashes][0];
    g.events.emit('shutdown');
    assert.equal(slash.active, false); assert.equal(slash.eventNames().length, 0);
    assert.equal(g.combatSystem.slashes.size, 0);
}

// A missing external effect retains baked character visuals; Candy never spawns the effect.
{
    const { game: g } = fixture('candy'); installSlashEffect(g);
    g.combatSystem.attack();
    assert.equal(g.combatSystem.slashes.size, 0); assert.equal(g.combatSystem.projectiles.length, 1);
    g.events.emit('shutdown');
}
console.log('PASS sword effect: actual PNG, five frames at 18 FPS once, left flip, range upgrade scaling, simultaneous character/effect playback, pause/resume, cleanup and unchanged damage/cooldowns/Candy.');

// Completing the character attack returns to the current grounded or airborne pose.
for (const state of ['idle', 'run', 'jump', 'fall']) {
    const { game: g } = fixture(); installSlashEffect(g);
    g.player = new Player(g, g.run, g.groundY);
    g.combatSystem = new CombatSystem(g, g.run, g.player, g.enemySystem,
        (x, y) => g.xpSystem.dropGem(x, y), () => g.endGame(), () => g.updateHud());
    const character = g.player.sprite.children[0];
    g.combatSystem.attack();
    assert.equal(character.animationKey, 'llama-crunch:attack');
    assert.equal(g.combatSystem.slashes.size, 1);
    character.anims.isPlaying = false;
    if (state === 'jump' || state === 'fall') {
        g.run.onGround = false; g.run.velocityY = state === 'jump' ? -150 : 150;
        g.player.sprite.y = g.groundY - 100;
    }
    g.player.update({ left: false, right: state === 'run', jump: false }, 0.01);
    assert.equal(character.animationKey, `llama-crunch:${state}`);
    g.events.emit('shutdown');
}
console.log('PASS simultaneous attacks: both five-frame animations start together, mirror/pause together and return to idle/run/jump/fall without changing combat.');

// Adventure movement: left boundary, unlimited forward travel and smooth camera.
for (const characterId of ['llamaCrunch', 'candy']) {
    const { game: g } = fixture(characterId);
    const player = new Player(g, g.run, g.groundY);
    player.sprite.x = 4000;
    const speed = CHARACTERS[characterId].moveSpeed;
    player.update({ left: false, right: true, jump: false }, 0.05);
    assert.equal(player.x, 4000 + speed * 0.05);
    player.update({ left: true, right: false, jump: false }, 0.05);
    assert.equal(player.x, 4000);
    player.sprite.x = 100000;
    player.update({ left: false, right: false, jump: false }, 0.05);
    assert.equal(player.x, 100000);
    player.sprite.x = -10;
    player.update({ left: false, right: false, jump: false }, 0.05);
    assert.equal(player.x, 45);
    const camera = g.cameras.main;
    for (let frame = 0; frame < 180; frame++) g.worldCamera.update(5000, 1 / 60);
    const screenRatio = (5000 - camera.scrollX) / camera.width;
    assert.ok(screenRatio >= 0.35 && screenRatio <= 0.40);
    assert.equal(camera.scrollY, 0);
    for (let frame = 0; frame < 180; frame++) g.worldCamera.update(100000, 1 / 60);
    assert.ok(Math.abs(camera.scrollX - (100000 - camera.width * WORLD.rightFollowRatio)) < 0.01);
    for (let frame = 0; frame < 180; frame++) {
        g.worldCamera.update(45, 1 / 60);
        assert.ok(camera.scrollX >= 0);
    }
    assert.equal(camera.scrollX, 0);
    camera.setScroll(5000, 0);
    new WorldCamera(camera, g.scale.height);
    assert.equal(camera.scrollX, 0);
    g.events.emit('shutdown');
}

// Fixed world placements retain difficulty metadata and survive camera movement.
{
    const { game: g } = fixture();
    const camera = g.cameras.main;
    g.run.runTime = 34;
    g.enemySystem.spawnBread(); const first = g.enemySystem.enemies[0];
    camera.setScroll(6000, 0);
    g.enemySystem.spawnBread(WORLD.enemyStartX + WORLD.enemySpacing * 8); const second = g.enemySystem.enemies[1];
    assert.equal(second.sprite.x - first.sprite.x, WORLD.enemySpacing * 8);
    assert.equal(second.sprite.x, WORLD.enemyStartX + WORLD.enemySpacing * 8);
    assert.equal(second.hp, 2); assert.ok(second.speed >= 175 && second.speed <= 235);
    assert.equal(first.hp, second.hp);
    g.enemySystem.update(0.05, () => {});
    assert.equal(first.sprite.active, false); // Distant sprite unloads; health remains in its record.
    assert.equal(g.enemySystem.records.get(first.placementId).hp, first.hp);
    assert.equal(first.sprite.x, WORLD.enemyStartX);
    assert.equal(second.sprite.active, true);
    g.events.emit('shutdown');
}

// World-space projectile hits and gem attraction remain independent of camera scroll.
{
    const { game: g } = fixture('candy');
    g.cameras.main.setScroll(6000, 0); g.player.x = 6500;
    g.enemySystem.spawnBread(); const enemy = g.enemySystem.enemies[0];
    enemy.sprite.x = 6750; enemy.sprite.y = g.player.y;
    g.combatSystem.attack();
    const shot = g.combatSystem.projectiles[0];
    g.combatSystem.update(0.2);
    assert.equal(shot.sprite.active, true); assert.equal(shot.sprite.x, 6660);
    g.combatSystem.update(0.1);
    assert.equal(g.run.kills, 1); assert.equal(shot.sprite.active, false);
    const gem = g.xpSystem.gems[0]; assert.equal(gem.sprite.x, 6750);
    g.xpSystem.update(1); assert.equal(gem.sprite.x, 6750); // No artificial scrolling.
    g.cameras.main.setScroll(7000, 0);
    g.xpSystem.update(1); assert.equal(gem.sprite.x, 6750); // Backtracking does not erase rewards.
    g.player.x = 6750; g.xpSystem.update(0.05);
    assert.equal(g.run.xp, 1); assert.equal(g.xpSystem.gems.length, 0);
    g.events.emit('shutdown');
}

// Sword effects/contact damage use the same world anchor at large positions.
{
    const { game: g } = fixture(); installSlashEffect(g);
    g.player.x = 8500; g.cameras.main.setScroll(8000, 0);
    g.enemySystem.spawnBread(); const enemy = g.enemySystem.enemies[0];
    enemy.hp = 7; enemy.sprite.x = 8540; enemy.sprite.y = g.player.y;
    g.combatSystem.attack(); assert.equal(enemy.hp, 5);
    const slash = [...g.combatSystem.slashes][0]; assert.equal(slash.x, 8500 + 115 / 2);
    enemy.sprite.x = 8500; g.combatSystem.checkContact(enemy);
    assert.equal(g.run.health, 5);
    g.events.emit('shutdown');
}

// The scene stops automatic scenery/distance progression and freezes the camera on pause.
{
    const { game: g, objects } = fixture();
    g.events.emit('shutdown'); installKeyboard(g); g.init({ characterId: 'llamaCrunch' }); g.create();
    g.enemySystem.update = () => {}; // Isolate exploration from temporary spawn behaviour.
    const worldRectangles = objects.filter(object => object.kind === 'rectangle' && object.scrollFactorX !== 0);
    const positions = worldRectangles.map(object => object.x);
    for (let frame = 0; frame < 60; frame++) g.update(frame * 16, 16);
    assert.equal(g.player.x, 170); assert.equal(g.run.distance, 0); assert.equal(g.cameras.main.scrollX, 0);
    assert.equal(JSON.stringify(worldRectangles.map(object => object.x)), JSON.stringify(positions));
    g.player.sprite.x = 5000;
    g.run.startX = g.run.furthestX = 5000;
    g.playerInput.keys.D.isDown = true;
    g.update(1000, 16);
    assert.ok(g.player.x > 5000);
    assert.equal(g.run.distance, (g.player.x - 5000) / WORLD.pixelsPerMetre);
    assert.ok(g.cameras.main.scrollX > 0);
    g.setPauseReason('focus', true);
    const snapshot = JSON.stringify(g.run), scroll = g.cameras.main.scrollX;
    for (let frame = 0; frame < 30; frame++) g.update(1100 + frame * 16, 16);
    assert.equal(JSON.stringify(g.run), snapshot); assert.equal(g.cameras.main.scrollX, scroll);
    g.setPauseReason('focus', false);
    const distance = g.run.distance;
    g.update(2000, 16); assert.equal(g.run.distance, distance);
    g.events.emit('shutdown');
    assert.equal(g.game.events.eventNames().length, 0);
}

// Real overlay renderers and touch buttons retain screen-space scroll factors/input coordinates.
{
    const { game: g, objects } = fixture(); g.cameras.main.setScroll(8000, 0);
    const { createUpgradePanel } = load('ui/UpgradePanel');
    let chosen;
    const panel = createUpgradePanel(g, 2, [{ title: 'POWER', description: '+1 damage' }], index => { chosen = index; });
    assert.equal(panel.scrollFactorX, 0);
    assert.ok(panel.children.filter(child => child.eventNames().includes('pointerdown'))
        .every(child => child.scrollFactorX === 0 && child.scrollFactorY === 0));
    const card = panel.children.find(child => child.eventNames().includes('pointerdown'));
    card.emit('pointerdown'); assert.equal(chosen, 0); assert.equal(card.x, 512);
    const { createGameOverPanel } = load('ui/GameOverPanel');
    const before = objects.length;
    createGameOverPanel(g, g.run, () => {}, () => {}, 'TRY AGAIN');
    assert.ok(objects.slice(before).filter(object => object !== panel).every(object => object.scrollFactorX === 0));
    const controlsStart = objects.length;
    installKeyboard(g); new PlayerInput(g, () => g.run.phase === 'playing');
    assert.ok(objects.slice(controlsStart).every(object => object.scrollFactorX === 0));
    const { Hud } = load('ui/Hud'); const hud = new Hud(g);
    assert.equal(hud.text.scrollFactorX, 0); assert.equal(hud.text.x, 18);
    assert.equal(g.rosie.panel.scrollFactorX, 0);
    assert.equal(g.rosie.panel.children.length, 3); // Portrait card, face, speech; no cage bars.
    g.events.emit('shutdown');
}

// Rosie appears briefly and occasionally; hide and dialogue timers obey scene pause/cleanup.
{
    const { game: g, rosie, advance, timers } = fixture('candy');
    assert.equal(rosie.panel.visible, true);
    advance(WORLD.rosieLineDuration); assert.equal(rosie.panel.visible, false);
    advance(WORLD.rosieDialogueInterval - WORLD.rosieLineDuration);
    assert.equal(rosie.panel.visible, true); assert.equal(rosie.speech.textChanges, 1);
    g.setPhase('paused'); advance(10000); assert.equal(rosie.panel.visible, true);
    g.setPhase('playing'); advance(WORLD.rosieLineDuration); assert.equal(rosie.panel.visible, false);
    g.events.emit('shutdown'); assert.ok(timers.every(timer => timer.removed));
}
console.log('PASS adventure Stage 1: free movement/world bounds, smooth bounded camera, world spawns, far-world combat/XP, static scenery, fixed UI, intermittent Rosie and pause/restart cleanup.');

// Camera framing is position-based: turning without moving must not swing the world.
{
    const { game: g } = fixture();
    const player = new Player(g, g.run, g.groundY);
    player.sprite.x = 5000;
    for (let i = 0; i < 180; i++) g.worldCamera.update(player.x, 1 / 60);
    const scroll = g.cameras.main.scrollX;
    for (const left of [true, false, true, false]) {
        player.update({ left, right: !left, jump: false }, 0);
        g.worldCamera.update(player.x, 1 / 60);
        assert.equal(g.cameras.main.scrollX, scroll);
        assert.ok(Math.abs(player.x - scroll - 1024 * WORLD.rightFollowRatio) < 1e-7);
    }
    g.events.emit('shutdown');
}

// World occupants stay fixed, survive backtracking and cannot stream/pile up while idle.
{
    const { game: g } = fixture();
    for (let i = 0; i < 2400; i++) { g.run.runTime += 0.05; g.enemySystem.update(0.05, () => {}); }
    assert.equal(g.enemySystem.enemies.length, 2); // One viewport of preparation, no timed stream.
    const first = g.enemySystem.enemies[0];
    assert.equal(first.sprite.x, WORLD.enemyStartX); assert.equal(first.sprite.scrollFactorX, 1);
    g.cameras.main.setScroll(5000, 0);
    for (let i = 0; i < 60; i++) g.enemySystem.update(0.05, () => {});
    assert.equal(first.sprite.x, WORLD.enemyStartX); assert.equal(first.sprite.active, false);
    g.cameras.main.setScroll(0, 0); g.enemySystem.update(0.05, () => {});
    const restored = g.enemySystem.enemies.find(enemy => enemy.placementX === WORLD.enemyStartX);
    assert.equal(restored.sprite.x, WORLD.enemyStartX); assert.equal(restored.sprite.visible, true);
    g.enemySystem.damage(restored, restored.hp);
    for (let i = 0; i < 2400; i++) g.enemySystem.update(0.05, () => {});
    assert.ok(g.enemySystem.enemies.every(enemy => enemy.sprite.x !== WORLD.enemyStartX));
    assert.equal(g.enemySystem.records.get(breadPlacementId(g.run.seed, WORLD.enemyStartX)).defeated, true);
    g.events.emit('shutdown'); assert.equal(g.enemySystem.records.size, 0);
}

function explorationFixture(characterId = 'llamaCrunch') {
    const result = fixture(characterId);
    result.game.events.emit('shutdown');
    installKeyboard(result.game); result.game.init({ characterId }); result.game.create();
    result.game.enemySystem.update = () => {}; // Isolate travel from contact damage.
    return result;
}

// Placement data exists before travel; sprites are prepared off-screen without a timer.
{
    const { game: g } = fixture();
    assert.equal(g.enemySystem.records.size, 0);
    g.enemySystem.prepare();
    assert.equal(g.enemySystem.enemies.length, 2);
    const first = g.enemySystem.enemies[0];
    first.hp = 7;
    const seen = new Set(g.enemySystem.enemies);
    for (let scroll = 0; scroll < 9000; scroll += 10) {
        g.cameras.main.setScroll(scroll, 0);
        g.enemySystem.update(0, enemy => {
            assert.equal(enemy.sprite.visible, true, 'No distant contact processing');
        });
        for (const enemy of g.enemySystem.enemies) {
            if (!seen.has(enemy)) {
                assert.ok(enemy.sprite.x - 29 > scroll + 1024, 'New bread must be fully outside viewport');
                seen.add(enemy);
            }
        }
        for (const x of [0, 1, 2, 3, 4].flatMap(index => generateSection(index, g.run.seed).enemies.map(enemy => enemy.x)).filter(x => x >= scroll && x <= scroll + 1024)) {
            assert.ok(g.enemySystem.enemies.some(enemy => enemy.sprite.x === x), 'Every visible slot already prepared');
        }
    }
    assert.ok(g.enemySystem.enemies.length <= 11, 'Live enemies remain bounded');
    assert.equal(first.hp, 7);
    const defeated = g.enemySystem.enemies[3]; const defeatedX = defeated.sprite.x;
    g.enemySystem.damage(defeated, defeated.hp);
    for (let scroll = 9000; scroll >= 0; scroll -= 10) {
        g.cameras.main.setScroll(scroll, 0); g.enemySystem.update(0, () => {});
        for (const enemy of g.enemySystem.enemies) {
            if (!seen.has(enemy)) {
                assert.ok(enemy.sprite.x + 29 < scroll || enemy.sprite.x - 29 > scroll + 1024,
                    'Restored bread must also be fully outside viewport on approach');
                seen.add(enemy);
            }
        }
    }
    const restored = g.enemySystem.enemies.find(enemy => enemy.placementX === WORLD.enemyStartX);
    assert.equal(restored.hp, 7);
    assert.notEqual(restored, first);
    assert.ok(!g.enemySystem.enemies.some(enemy => enemy.sprite.x === defeatedX));
    assert.equal(g.run.runTime, 0, 'Preparation has no timer dependency');
    g.events.emit('shutdown');
    assert.equal(g.enemySystem.records.size, 0);
}

// The real scene starts with its off-screen occupants ready before rendering.
{
    const { game: g } = explorationFixture();
    assert.equal(g.enemySystem.enemies.length, 2);
    assert.ok(g.enemySystem.enemies.every(enemy => enemy.sprite.x - 29 > 1024));
    g.events.emit('shutdown');
}

// Progress is a furthest-world-X high-water mark, not accumulated movement or idle time.
{
    const { game: g } = explorationFixture();
    const walk = (key, frames) => {
        g.playerInput.keys.D.isDown = key === 'D'; g.playerInput.keys.A.isDown = key === 'A';
        for (let frame = 0; frame < frames; frame++) g.update(frame * 1000 / 60, 1000 / 60);
    };
    walk('D', 60); const first = g.run.distance;
    assert.ok(Math.abs(first - 280 / WORLD.pixelsPerMetre) < 1e-7);
    walk('A', 60); assert.equal(g.run.distance, first);
    walk('D', 30); assert.equal(g.run.distance, first);
    walk('', 60); assert.equal(g.run.distance, first);
    walk('D', 60); assert.ok(g.run.distance > first);
    assert.ok(Math.abs(g.run.distance - 420 / WORLD.pixelsPerMetre) < 1e-7);
    assert.equal(g.run.furthestX, g.player.x);
    g.events.emit('shutdown');
}

// Low render rates must not reduce movement speed by discarding delta above 50 ms.
for (const fps of [60, 20, 15, 8]) {
    const { game: g } = explorationFixture();
    g.playerInput.keys.D.isDown = true;
    for (let frame = 0; frame < fps; frame++) g.update(frame * 1000 / fps, 1000 / fps);
    assert.ok(Math.abs(g.player.x - 450) < 1e-7, `${fps} FPS movement differs`);
    assert.ok(Math.abs(g.run.runTime - 1) < 1e-7);
    assert.ok(Math.abs(g.run.distance - 280 / WORLD.pixelsPerMetre) < 1e-7);
    g.events.emit('shutdown');
}

// Unsmoothed 30 FPS time yields identical early/late speed for either character.
for (const [characterId, speed] of [['llamaCrunch', 280], ['candy', 350]]) {
    const { game: g } = explorationFixture(characterId);
    g.playerInput.keys.D.isDown = true;
    for (let second = 0; second < 8; second++) {
        const startX = g.player.x;
        for (let frame = 0; frame < 30; frame++) g.update(0, 1000 / 30);
        assert.ok(Math.abs(g.player.x - startX - speed) < 1e-7);
        assert.equal(g.run.moveSpeed, speed);
    }
    g.events.emit('shutdown');
}

// Scenery is static world geometry and only the visible strip is submitted for rendering.
{
    const { game: g } = explorationFixture();
    const scenery = () => [...g.world.sections.values()].flatMap(section => section.scenery);
    const coordinates = scenery().map(block => block.x);
    assert.ok(scenery().filter(block => block.visible).length <= 12);
    assert.ok(scenery().every(block => block.scrollFactorX === 1));
    g.cameras.main.setScroll(8000, 0); g.world.update();
    assert.ok(scenery().filter(block => block.visible).length <= 12);
    assert.ok(scenery().filter(block => block.visible).every(block => block.x > 7000));
    g.cameras.main.setScroll(0, 0); g.world.update();
    assert.equal(scenery()[0].visible, true);
    assert.deepEqual(scenery().filter(block => block.x < WORLD.sectionLength).map(block => block.x),
        coordinates.filter(x => x < WORLD.sectionLength));
    g.events.emit('shutdown');
}

// Temporary coordinate/FPS overlay reports world-to-screen maths and redraws at most 5 Hz.
{
    const { game: g } = fixture();
    const { WorldDebug } = load('ui/WorldDebug');
    g.player.x = 2500; g.cameras.main.setScroll(2100, 0);
    g.enemySystem.spawnBread(2600);
    const debug = new WorldDebug(g);
    debug.update(g.player, g.cameras.main, g.enemySystem.enemies, 16);
    const text = debug.text.text.join('\n');
    assert.ok(text.includes('Player world X:  2500.0'));
    assert.ok(text.includes('Camera scroll X: 2100.0'));
    assert.ok(text.includes('Player screen X: 400.0'));
    assert.ok(text.includes('Enemy world X:   2600.0'));
    assert.equal(debug.text.scrollFactorX, 0);
    const updates = debug.text.textChanges;
    for (let i = 0; i < 199; i++) debug.update(g.player, g.cameras.main, g.enemySystem.enemies, 1);
    assert.equal(debug.text.textChanges, updates);
    debug.update(g.player, g.cameras.main, g.enemySystem.enemies, 1);
    assert.equal(debug.text.textChanges, updates + 1);
    g.events.emit('shutdown');
}
console.log('PASS world corrections: stable framing on turns, persistent fixed enemies, no idle spawn stream, furthest-forward progress, render culling, low-FPS speed and throttled coordinate diagnostics.');

// Diagnostics use raw elapsed time, detecting half-speed simulation even when FPS is stable.
for (const simulationRatio of [0.5, 1]) {
    const { game: g } = fixture();
    const { WorldDebug } = load('ui/WorldDebug');
    const debug = new WorldDebug(g);
    g.game.loop = { rawDelta: 1000 / 30, actualFps: 30 };
    debug.resetSample(g.player, g.cameras.main);
    for (let frame = 0; frame < 240; frame++) {
        g.player.x += 280 / 30 * simulationRatio;
        debug.update(g.player, g.cameras.main, [], 1000 / 30 * simulationRatio,
            1000 / 30 * simulationRatio, 280);
        if (frame === 29 || frame === 239) {
            const text = debug.text.text.join('\n');
            assert.ok(text.includes(`World speed: ${(280 * simulationRatio).toFixed(1)} / 280 units/s`));
            assert.ok(text.includes(`Sim / real time: ${simulationRatio.toFixed(2)}x`));
        }
    }
    debug.resetSample(g.player, g.cameras.main);
    assert.equal(debug.elapsed, 0); assert.equal(debug.travelled, 0);
    g.events.emit('shutdown');
}
console.log('PASS startup fixes: unsmoothed engine time, raw-time speed diagnostics, off-screen preparation, bounded active occupants, persistent health/deaths and no timed pop-in.');

// Endless section descriptors are deterministic, contiguous and preserve the original lattices.
{
    const a = generateSection(25, 12345), b = generateSection(25, 12345);
    assert.deepEqual(a, b);
    assert.notEqual(a.seed, generateSection(25, 54321).seed);
    assert.equal(a.endX, generateSection(26, 12345).startX);
    assert.ok(a.enemies.every(({ x }) => x >= a.startX && x < a.endX && (x - WORLD.enemyStartX) % WORLD.enemySpacing === 0));
    assert.ok(a.sceneryXs.every(x => x >= a.startX && x < a.endX && x % 160 === 0));
    assert.equal(createRunState('candy', 12345).seed, 12345);
}

// Distant occupants release sprites, retaining wounds/difficulty/deaths across many sections.
{
    const { game: g } = fixture(); g.run.seed = 12345; g.enemySystem.prepare();
    const wounded = g.enemySystem.enemies[0]; wounded.hp = 7;
    g.enemySystem.damage(wounded, 2);
    const speed = wounded.speed, dead = g.enemySystem.enemies[1], deadX = dead.placementX;
    g.enemySystem.damage(dead, dead.hp);
    for (let index = 1; index < 200; index++) {
        g.cameras.main.setScroll(index * WORLD.sectionLength, 0);
        g.run.runTime += 60;
        g.world.update(); g.enemySystem.prepare();
        assert.ok(g.world.sections.size <= 5);
        assert.ok(g.enemySystem.enemies.length <= 14);
    }
    assert.equal(wounded.sprite.active, false);
    for (let index = 199; index >= 0; index--) {
        g.cameras.main.setScroll(index * WORLD.sectionLength, 0);
        g.world.update(); g.enemySystem.prepare();
    }
    const restored = g.enemySystem.enemies.find(enemy => enemy.placementX === wounded.placementX);
    assert.equal(restored.hp, 5); assert.equal(restored.speed, speed);
    assert.ok(!g.enemySystem.enemies.some(enemy => enemy.placementX === deadX));
    assert.equal(g.enemySystem.records.get(dead.placementId).defeated, true);
    g.events.emit('shutdown'); assert.equal(g.world.sections.size, 0); assert.equal(g.enemySystem.records.size, 0);
}

// Uncollected XP streams out/in exactly once at its last attracted position; collected XP stays gone.
{
    const { game: g } = fixture();
    const originalX = g.player.x + 55, y = g.player.y;
    g.xpSystem.dropGem(originalX, y); g.xpSystem.update(0.01);
    const x = g.xpSystem.gems[0].sprite.x;
    assert.ok(x < originalX);
    g.cameras.main.setScroll(30000, 0); g.player.x = 30400;
    g.xpSystem.update(0);
    assert.equal(g.xpSystem.gems.length, 0);
    assert.equal(g.xpSystem.dormant.get(0).length, 1);
    g.cameras.main.setScroll(0, 0); g.player.x = 170;
    for (let i = 0; i < 10; i++) g.xpSystem.update(0);
    assert.equal(g.xpSystem.gems.length, 1); assert.equal(g.xpSystem.gems[0].sprite.x, x);
    assert.equal(g.xpSystem.dormant.size, 0);
    g.player.x = x; g.xpSystem.update(0);
    assert.equal(g.run.xp, 1); assert.equal(g.xpSystem.gems.length, 0);
    for (const scroll of [30000, 0, 50000, 0]) {
        g.cameras.main.setScroll(scroll, 0); g.player.x = scroll + 400; g.xpSystem.update(0);
        assert.equal(g.xpSystem.gems.length, 0); assert.equal(g.xpSystem.dormant.size, 0);
    }
    assert.equal(g.run.xp, 1);
    // Existing magnet upgrades must also reach dormant drops beyond the visible viewport.
    g.cameras.main.setScroll(0, 0); g.player.x = 170; g.xpSystem.dropGem(200, y);
    g.cameras.main.setScroll(30000, 0); g.player.x = 30400; g.xpSystem.update(0);
    g.run.magnetRadius = 31000; g.xpSystem.update(0.01);
    assert.equal(g.xpSystem.dormant.size, 0); assert.equal(g.xpSystem.gems.length, 1);
    g.events.emit('shutdown'); assert.equal(g.xpSystem.dormant.size, 0);
}

// Live terrain/enemy/XP objects stay bounded over long travel with drops left behind.
{
    const { game: g, objects } = fixture();
    let maxActive = 0;
    for (let index = 0; index < 1000; index++) {
        const scroll = index * WORLD.sectionLength;
        g.cameras.main.setScroll(scroll, 0); g.player.x = scroll + 400;
        g.world.update(); g.enemySystem.prepare();
        g.xpSystem.dropGem(scroll + 900, g.player.y); g.xpSystem.update(0);
        const active = objects.filter(object => object.active).length;
        maxActive = Math.max(maxActive, active);
        assert.ok(active < 230, `Live objects grew at section ${index}: ${active}`);
        assert.ok(g.xpSystem.gems.length <= 5);
    }
    assert.ok(g.enemySystem.records.size > 1000, 'Persistent records, not sprites, retain visited state');
    assert.ok(g.xpSystem.dormant.size > 900, 'Uncollected rewards remain available');
    console.log(`PASS streaming growth: 1,000 sections / 2.56 million world units, maximum ${maxActive} live objects (including children).`);
    g.events.emit('shutdown');
    assert.equal(objects.filter(object => object.active && object.scrollFactorX === 1).length, 0);
}

// The real scene walks beyond the previous endpoint with continuous speed/framing/progress.
for (const characterId of ['llamaCrunch', 'candy']) {
    const { game: g } = explorationFixture(characterId);
    g.player.sprite.x = 15500;
    for (let i = 0; i < 180; i++) g.worldCamera.update(g.player.x, 1 / 60);
    g.playerInput.keys.D.isDown = true;
    let previousScroll = g.cameras.main.scrollX;
    for (let i = 0; i < 180; i++) {
        g.update(i * 1000 / 30, 1000 / 30);
        assert.ok(g.cameras.main.scrollX >= previousScroll);
        assert.ok(g.cameras.main.scrollX - previousScroll < 15, 'No camera jump on extension');
        previousScroll = g.cameras.main.scrollX;
    }
    assert.ok(g.player.x > 17000);
    assert.ok(Math.abs(g.player.x - 15500 - CHARACTERS[characterId].moveSpeed * 6) < 1e-6);
    const distance = g.run.distance;
    g.playerInput.keys.D.isDown = false; g.playerInput.keys.A.isDown = true;
    for (let i = 0; i < 300; i++) g.update(0, 1000 / 30);
    assert.equal(g.run.distance, distance);
    g.events.emit('shutdown');
}
console.log('PASS endless foundation: seeded sections, unbounded forward movement/camera, persistent wounds/deaths/rewards, bounded live objects, cleanup and forward-only scoring.');

// Arbitrarily upgraded melee reach still has loaded targets outside the normal buffer.
{
    const { game: g } = fixture();
    g.run.weapon.range = 10000;
    g.enemySystem.prepare();
    const distant = g.enemySystem.enemies.find(enemy => enemy.sprite.x > 9000);
    assert.ok(distant);
    g.enemySystem.prepare();
    assert.ok(g.enemySystem.enemies.includes(distant));
    assert.equal(distant.sprite.active, true);
    assert.equal(g.run.weapon.range, 10000);
    g.events.emit('shutdown');
}

// Re-entering sections cannot duplicate terrain, enemy placements, or live/dormant rewards.
{
    const { game: g, objects } = fixture();
    g.enemySystem.prepare();
    const wounded = g.enemySystem.enemies[0], dead = g.enemySystem.enemies[1];
    wounded.hp = 7; g.enemySystem.damage(wounded, 2); g.enemySystem.damage(dead, dead.hp);
    const woundedId = wounded.placementId, deadId = dead.placementId;
    // Two legitimate drops at the same position must remain distinct, exactly once each.
    g.xpSystem.dropGem(800, g.player.y - 200);
    g.xpSystem.dropGem(800, g.player.y - 200);
    const rewardIds = Array.from(g.xpSystem.gems, gem => gem.id);
    g.xpSystem.dropGem(1800, g.player.y);
    const collectedId = g.xpSystem.gems.at(-1).id;
    g.player.x = 1800; g.xpSystem.update(0); assert.equal(g.run.xp, 1);
    const descriptions = new Map();
    let maxActive = 0;
    const check = scroll => {
        g.cameras.main.setScroll(scroll, 0); g.player.x = scroll + 400;
        g.run.runTime += 0.1;
        // Repeated preparation at an identical boundary must be idempotent.
        for (let repeat = 0; repeat < 3; repeat++) {
            g.world.update(); g.enemySystem.prepare(); g.xpSystem.update(0);
        }
        const terrain = [];
        for (const [index, section] of g.world.sections) {
            assert.equal(section.data.id, `${g.run.seed}:${index}`);
            if (!descriptions.has(index)) descriptions.set(index, JSON.stringify(section.data));
            assert.equal(JSON.stringify(section.data), descriptions.get(index));
            terrain.push(...section.objects);
        }
        const terrainKeys = terrain.map(object => `${object.args[2]}:${object.x}:${object.y}`);
        assert.equal(new Set(terrainKeys).size, terrain.length);
        const terrainColours = [0x8195a7, 0x65865b, 0x425b3c];
        const activeTerrain = objects.filter(object => object.active && object.kind === 'rectangle' && terrainColours.includes(object.args[2]));
        assert.equal(activeTerrain.length, terrain.length, 'No live orphan terrain after unload/reload');
        const enemies = g.enemySystem.enemies;
        assert.equal(new Set(enemies.map(enemy => enemy.placementId)).size, enemies.length);
        assert.ok(!enemies.some(enemy => enemy.placementId === deadId));
        const restored = enemies.find(enemy => enemy.placementId === woundedId);
        if (restored) assert.equal(restored.hp, 5);
        const drops = [...g.xpSystem.gems.map(gem => ({ id: gem.id, x: gem.sprite.x, y: gem.sprite.y, value: gem.value })),
            ...[...g.xpSystem.dormant.values()].flat()];
        const dropIds = drops.map(gem => gem.id);
        assert.equal(new Set(dropIds).size, drops.length, 'A drop cannot be both live and dormant');
        assert.deepEqual(dropIds.sort((a, b) => a - b), rewardIds);
        assert.ok(!dropIds.includes(collectedId));
        assert.ok(drops.every(drop => drop.x === 800 && drop.y === g.player.y - 200 && drop.value === 1));
        assert.equal(g.run.xp, 1);
        maxActive = Math.max(maxActive, objects.filter(object => object.active).length);
        assert.ok(g.world.sections.size <= 5); assert.ok(enemies.length <= 14);
    };
    const end = WORLD.sectionLength * 12;
    for (let scroll = 0; scroll <= end; scroll += 160) check(scroll);
    const savedEnemyState = JSON.stringify([...g.enemySystem.records].sort());
    for (let scroll = end; scroll >= 0; scroll -= 160) check(scroll);
    assert.equal(JSON.stringify([...g.enemySystem.records].sort()), savedEnemyState);
    for (let scroll = 0; scroll <= end; scroll += 160) check(scroll);
    assert.equal(JSON.stringify([...g.enemySystem.records].sort()), savedEnemyState);
    assert.ok(maxActive < 200);
    g.events.emit('shutdown');
    assert.equal(g.world.sections.size, 0); assert.equal(g.enemySystem.records.size, 0);
    assert.equal(g.xpSystem.gems.length, 0); assert.equal(g.xpSystem.dormant.size, 0);
    console.log(`PASS round-trip sections: forward/back/forward across 12 sections, stable IDs/state, no duplicate terrain/enemies/XP, maximum ${maxActive} live objects.`);
}

// Duplicate preparation cannot create a second instance or award a second death.
{
    const { game: g } = fixture();
    const first = g.enemySystem.spawnBread();
    assert.equal(g.enemySystem.spawnBread(), first);
    assert.equal(g.enemySystem.enemies.length, 1);
    assert.equal(g.enemySystem.damage(first, first.hp), true);
    const hp = first.hp;
    assert.equal(g.enemySystem.damage(first, 2), false); assert.equal(first.hp, hp);
    assert.equal(g.enemySystem.spawnBread(), undefined);
    assert.equal(g.enemySystem.enemies.length, 0);
    // Content IDs, rather than coordinates, distinguish future colocated placements.
    const a = g.enemySystem.spawnBread(2000, 'test:placement:a');
    const b = g.enemySystem.spawnBread(2000, 'test:placement:b');
    assert.notEqual(a, b); assert.equal(g.enemySystem.records.size, 3);
    g.events.emit('shutdown');
}
