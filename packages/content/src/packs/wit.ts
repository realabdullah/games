import type { Flavour } from '../flavour.ts';
import type { PromptPack } from '../types.ts';
import global from '../prompts/wit.json';
import naija from '../prompts/wit.ng.json';
import { toPromptPack } from './prompts.ts';

export const witPacks: Record<Flavour, PromptPack> = {
	naija: toPromptPack(naija),
	global: toPromptPack(global)
};
