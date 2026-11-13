import { Utils } from 'phaser';
import type { CharacterId } from '../characters/definitions';
import { LLAMA_CRUNCH_LINES } from './data/llamaCrunch';
import { CANDY_LINES } from './data/candy';

export type RosieEvent = 'start' | 'taunt' | 'damage' | 'levelUp' | 'death';
export type RosieLines = Record<RosieEvent, readonly string[]>;
export type RosieDialogueContext = { event: RosieEvent; characterId: CharacterId };

const LINES: Record<CharacterId, RosieLines> = { llamaCrunch: LLAMA_CRUNCH_LINES, candy: CANDY_LINES };

export function getRosieLine(context: RosieDialogueContext): string {
    return Utils.Array.GetRandom([...LINES[context.characterId][context.event]]);
}
