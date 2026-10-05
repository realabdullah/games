import doodleWords from '../prompts/doodle.json';
import { toPromptPack } from './prompts.ts';

export const doodlePack = toPromptPack(doodleWords);
