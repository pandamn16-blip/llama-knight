// Focused pure-geometry tests; does not require a browser or Phaser.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const exports = {};
const source = fs.readFileSync(path.join(__dirname, '../src/game/world/terrain.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020
} }).outputText;
vm.runInNewContext(code, { exports, require: () => ({
    WORLD: { sectionLength: 2560, terrainTileSize: 64 }
}) });
const { generatePlatforms, landingSurfaceY, standingSurfaceY } = exports;

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
