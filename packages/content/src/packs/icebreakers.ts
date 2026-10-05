import icebreakerPrompts from '../prompts/icebreakers.json';
import { toPromptPack } from './prompts.ts';

export const icebreakerPack = toPromptPack(icebreakerPrompts);
