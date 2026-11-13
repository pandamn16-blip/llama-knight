import { Utils } from 'phaser';
import { BALANCE } from '../config/balance';
import type { Upgrade } from '../data/upgrades';

// The caller supplies the eligible pool; the UI only receives the resulting choices.
export function selectUpgrades(pool: readonly Upgrade[]): Upgrade[] {
    return Utils.Array.Shuffle([...pool]).slice(0, BALANCE.upgrades.choiceCount);
}
