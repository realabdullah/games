import type { Flavour } from '../flavour.ts';
import type { PromptPack } from '../types.ts';
import global from '../prompts/icebreakers.json';
import naija from '../prompts/icebreakers.ng.json';
import { toPromptPack } from './prompts.ts';

export const icebreakerPacks: Record<Flavour, PromptPack> = {
	naija: toPromptPack(naija),
	global: toPromptPack(global)
};
