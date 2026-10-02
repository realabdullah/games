import type { HangmanView } from '@games/hangman';
import { t } from '$lib/i18n';

/** What just happened, as a sentence ("Ada found 2 Es", or "You found 2 Es" on your own screen). */
export function eventText(event: NonNullable<HangmanView['event']>, youId?: string | null): string {
	const name = event.player?.name ?? '';
	const m = t.hangman;
	if (youId && event.player?.id === youId) {
		const y = m.you;
		switch (event.kind) {
			case 'hit':
				return y.hit(event.letter ?? '', event.count ?? 1);
			case 'miss':
				return y.miss(event.letter ?? '');
			case 'timeout':
				return y.timeout;
			case 'wrong-solve':
				return y.wrongSolve(event.text ?? '');
			case 'solve':
				return y.solved;
		}
	}
	switch (event.kind) {
		case 'hit':
			return m.hit(name, event.letter ?? '', event.count ?? 1);
		case 'miss':
			return m.miss(name, event.letter ?? '');
		case 'timeout':
			return m.timeout(name);
		case 'wrong-solve':
			return m.wrongSolve(name, event.text ?? '');
		case 'solve':
			return m.solvedBy(name);
	}
}
