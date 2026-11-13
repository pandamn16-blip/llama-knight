import { BALANCE } from '../config/balance';
import type { RunState } from '../state/RunState';
import type { UpgradeId } from '../data/upgrades';

export function applyUpgrade(state: RunState, id: UpgradeId): void {
    const amounts = BALANCE.upgrades;
    switch (id) {
        case 'power': state.weapon.damage += amounts.damage; break;
        case 'speed': state.weapon.cooldown = Math.max(amounts.minCooldown,
            Math.round(state.weapon.cooldown * amounts.cooldownMultiplier)); break;
        case 'range': state.weapon.range += amounts.range; break;
        case 'heart':
            state.maxHealth += amounts.maxHealth;
            state.health = Math.min(state.maxHealth, state.health + amounts.healing);
            break;
        case 'magnet': state.magnetRadius += amounts.magnetRadius; break;
        case 'stride': state.moveSpeed *= amounts.moveSpeedMultiplier; break;
    }
}
