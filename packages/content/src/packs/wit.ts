import witPrompts from '../prompts/wit.json';
import { toPromptPack } from './prompts.ts';

export const witPack = toPromptPack(witPrompts);
