// Focused pure-geometry tests; does not require a browser or Phaser.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const moduleExports = {};
const source = fs.readFileSync(path.join(__dirname, '../src/game/world/terrain.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020
} }).outputText;
vm.runInNewContext(code, { exports: moduleExports, require: () => ({
    WORLD: { sectionLength: 2560, terrainTileSize: 64 }
}) });
const { generatePlatforms, landingSurfaceY, standingSurfaceY, generateTerrainGaps,
    terrainLayoutKind, TERRAIN_LAYOUTS, groundExists, terrainSegmentImpact } = moduleExports;

test('platforms are reproducible and keep main ground open', () => {
    for (let index = 0; index < 20; index++) {
        const one = generatePlatforms(index, 42, 0x1234567 + index);
        const two = generatePlatforms(index, 42, 0x1234567 + index);
        assert.deepEqual(JSON.parse(JSON.stringify(one)), JSON.parse(JSON.stringify(two)));
        for (const platform of one) {
            assert.ok(platform.height <= 192);
            assert.ok(platform.width >= 192);
            assert.ok(platform.x - platform.width / 2 >= index * 2560);
            assert.ok(platform.x + platform.width / 2 < (index + 1) * 2560);
        }
    }
});

test('falling onto upper ledge lands, while rising through it does not', () => {
    const platforms = [{ id: 'test', x: 400, width: 192, height: 96 }];
    const ground = 600, top = 504;
    assert.equal(landingSurfaceY(platforms, ground, 400, 500, 510), top);
    assert.equal(landingSurfaceY(platforms, ground, 400, 510, 500), undefined);
    assert.equal(standingSurfaceY(platforms, ground, 400, top), top);
    assert.equal(standingSurfaceY(platforms, ground, 700, top), undefined);
    assert.equal(landingSurfaceY(platforms, ground, 700, 598, 610), ground);
});


test('all twelve planned terrain archetypes generate reproducibly and remain navigable', () => {
    assert.equal(TERRAIN_LAYOUTS.length, 12);
    const visited = new Set();
    for (let index = 0; index < 36; index++) {
        const name = terrainLayoutKind(index);
        visited.add(name);
        const roll = Math.imul(index + 1, 0x102031) >>> 0;
        const a = generatePlatforms(index, 991, roll);
        const b = generatePlatforms(index, 991, roll);
        assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
        assert.ok(a.length >= 4, 'Two saved legacy high-perch slots always exist');
        assert.equal(new Set(a.map(platform => platform.id)).size, a.length);
        for (const platform of a) {
            assert.ok(platform.x - platform.width / 2 >= index * 2560,
                'Platforms never spill across section boundaries');
            assert.ok(platform.x + platform.width / 2 < (index + 1) * 2560);
            assert.ok(platform.height > 0 && platform.height <= 192);
        }
        for (let i = 1; i < a.length; i++) {
            assert.ok(a[i].x > a[i - 1].x, 'Stepping-stone order is left-to-right');
            assert.ok(a[i].x - a[i - 1].x <= 850,
                'Upper-route segments fit inside the section; longer spans have ground below');
        }
        const gaps = generateTerrainGaps(index, roll);
        for (const gap of gaps) {
            assert.ok(gap.end - gap.start <= 120, 'Pits are short enough to jump');
            assert.ok(gap.start >= index * 2560 + 150);
            assert.ok(gap.end <= (index + 1) * 2560 - 150);
        }
    }
    assert.equal(visited.size, 12);
    assert.equal(terrainLayoutKind(0), 'flat-beginner', 'Start with safe introductory terrain');
});

test('broken bridges and alternating pits remove physical ground and block shots correctly', () => {
    for (const index of [2, 7, 14, 19]) {
        const gaps = generateTerrainGaps(index, 123);
        assert.ok(gaps.length >= 2);
        for (const gap of gaps) {
            const centre = (gap.start + gap.end) / 2;
            assert.equal(groundExists(centre, gaps), false);
            assert.equal(groundExists(gap.start - 10, gaps), true);
            assert.equal(landingSurfaceY([], 600, centre, 599, 630, gaps), undefined);
            assert.equal(standingSurfaceY([], 600, centre, 600, gaps), undefined);
            assert.equal(landingSurfaceY([], 600, gap.start - 10, 599, 630, gaps), 600);
            assert.equal(terrainSegmentImpact([], 600, centre, 570, centre, 630, gaps),
                undefined, 'Projectile can pass through pit opening');
            const wall = terrainSegmentImpact([], 600,
                gap.start - 12, 590, gap.start - 12, 630, gaps);
            assert.ok(wall, 'Projectile hits surrounding ground');
        }
    }
});


test('landmarks are deterministic, varied and confined to their section', () => {
    const results = {};
    const landmarkSource = fs.readFileSync(path.join(__dirname, '../src/game/world/landmarks.ts'), 'utf8');
    const compiled = ts.transpileModule(landmarkSource, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020
    } }).outputText;
    vm.runInNewContext(compiled, { exports: results, require: () => ({
        WORLD: { sectionLength: 2560 }
    }) });
    const { generateLandmarks } = results;
    const seenKinds = new Set();
    for (let index = 0; index < 30; index++) {
        const one = generateLandmarks(index, 65, Math.imul(index + 1, 0x9e3779b1) >>> 0);
        const two = generateLandmarks(index, 65, Math.imul(index + 1, 0x9e3779b1) >>> 0);
        assert.deepEqual(JSON.parse(JSON.stringify(one)), JSON.parse(JSON.stringify(two)));
        assert.equal(new Set(one.map(item => item.id)).size, one.length);
        assert.ok(one.length <= 4);
        for (const item of one) {
            seenKinds.add(item.kind);
            assert.ok(item.x >= index * 2560 && item.x < (index + 1) * 2560);
        }
    }
    assert.ok(seenKinds.size >= 4, 'Landmark repertoire includes distinct shapes');
});


test('swept fireballs explode on the first ledge or ground crossing', () => {
    const { terrainSegmentImpact } = moduleExports;
    const ledge = [{ id: 'shield', x: 400, width: 192, height: 96 }];
    const ground = 600;
    const hit = terrainSegmentImpact(ledge, ground, 400, 460, 400, 560);
    assert.ok(hit);
    assert.equal(hit.y, 504, 'Projectile hits the top of the ledge');
    assert.ok(hit.t > 0 && hit.t < 1, 'Collision occurs during the sweep');
    const bottomHit = terrainSegmentImpact([], ground, 250, 585, 250, 620);
    assert.ok(bottomHit);
    assert.equal(bottomHit.y, ground, 'Fireball explodes on the ground');
    assert.equal(terrainSegmentImpact(ledge, ground, 100, 250, 200, 260), undefined,
        'Clear shots do not collide');
});

test('hidden Bread heads beneath ledges are not exposed', () => {
    const { headCoveredByPlatform } = moduleExports;
    const ledge = [{ id: 'shield', x: 400, width: 192, height: 96 }];
    assert.equal(headCoveredByPlatform(ledge, 600, 400, 568), true,
        'Ground-level Bread is covered by the platform above it');
    assert.equal(headCoveredByPlatform(ledge, 600, 400, 472), false,
        'An elevated Pyromancer above the ledge is exposed');
    assert.equal(headCoveredByPlatform(ledge, 600, 200, 568), false,
        'An enemy away from the platform is exposed');
});
