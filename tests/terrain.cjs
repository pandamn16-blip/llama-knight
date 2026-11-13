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
const { generatePlatforms, landingSurfaceY, standingSurfaceY } = moduleExports;

test('platforms are reproducible and keep main ground open', () => {
    for (let index = 0; index < 20; index++) {
        const one = generatePlatforms(index, 42, 0x1234567 + index);
        const two = generatePlatforms(index, 42, 0x1234567 + index);
        assert.deepEqual(JSON.parse(JSON.stringify(one)), JSON.parse(JSON.stringify(two)));
        for (const platform of one) {
            assert.ok(platform.height <= 112);
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


test('upper-route motifs vary but retain reachable pairs', () => {
    const signatures = new Set();
    for (let roll = 0; roll < 48; roll++) {
        const ledges = generatePlatforms(2, 991, roll * 0x102031);
        signatures.add(ledges.map(p => [p.x - 5120, p.width, p.height].join(':')).join('|'));
        assert.equal(ledges.length, 4);
        for (const [a, b] of [[ledges[0], ledges[1]], [ledges[2], ledges[3]]]) {
            assert.ok(b.x > a.x && b.x - a.x <= 400, 'No precision long jump on paired route');
            assert.ok(b.height >= a.height && b.height - a.height <= 48,
                'A reachable second step, never a sudden large vertical climb');
        }
    }
    assert.ok(signatures.size >= 6, 'Distinct terrain shapes rather than one repeated layout');
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
