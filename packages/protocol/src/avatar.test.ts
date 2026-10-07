import { describe, expect, test } from 'bun:test';
import * as v from 'valibot';
import { JoinRoomBody } from './index';

describe('avatars', () => {
	test('motif ids pass', () => {
		expect(v.parse(JoinRoomBody, { name: 'Ada', avatar: 'rings' }).avatar).toBe('rings');
	});

	test('anything else is rejected, including the bot motif and emoji', () => {
		expect(() => v.parse(JoinRoomBody, { name: 'Ada', avatar: 'bot' })).toThrow();
		expect(() => v.parse(JoinRoomBody, { name: 'Ada', avatar: '🦊' })).toThrow();
	});
});
