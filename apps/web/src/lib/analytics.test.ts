/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { anonymizePath } from './analytics.ts';

test('room and pack codes never reach analytics', () => {
	expect(anonymizePath('/host/ABCD')).toBe('/host/:code');
	expect(anonymizePath('/play/wxyz')).toBe('/play/:code');
	expect(anonymizePath('/packs/K7P2QX')).toBe('/packs/:code');
	expect(anonymizePath('/packs/new')).toBe('/packs/new');
	expect(anonymizePath('/solo/trivia')).toBe('/solo/trivia');
	expect(anonymizePath('/')).toBe('/');
});
