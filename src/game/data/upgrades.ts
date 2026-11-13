export type UpgradeId = 'power' | 'speed' | 'range' | 'heart' | 'magnet' | 'stride';
export type Upgrade = { id: UpgradeId; title: string; description: string };

export const UPGRADES: Upgrade[] = [
    { id: 'power', title: 'HEAVIER SHIELD', description: '+1 attack damage' },
    { id: 'speed', title: 'FURIOUS LLAMA', description: 'Attack 15% faster' },
    { id: 'range', title: 'LONGER BONK', description: '+20 attack reach' },
    { id: 'heart', title: 'EMERGENCY SNACK', description: '+1 max health and heal 2' },
    { id: 'magnet', title: 'CRUMB MAGNET', description: 'Pick up XP from farther away' },
    { id: 'stride', title: 'FAST HOOVES', description: '+12% movement speed' }
];
