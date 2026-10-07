<script lang="ts">
	import { MAX_GUESSES, WORD_LENGTH, type Mark } from '@games/wordrace';
	import { t } from '$lib/i18n';

	/**
	 * A Word Race grid. Rows with a `word` show their letters (your own board);
	 * rows without show only the colours (everyone's boards on the big screen).
	 */
	interface Props {
		rows: { word?: string; marks: Mark[] }[];
		/** Show a row for typing, holding `current`. */
		typing?: boolean;
		current?: string;
		/** Changes when a guess is refused, to shake the typing row. */
		shake?: number;
		size?: 'lg' | 'sm';
		label: string;
	}
	let { rows, typing = false, current = '', shake = 0, size = 'lg', label }: Props = $props();
	const m = t.wordrace;

	const showTyping = $derived(typing && rows.length < MAX_GUESSES);
	const blank = $derived(Math.max(0, MAX_GUESSES - rows.length - (showTyping ? 1 : 0)));
	const cols = Array.from({ length: WORD_LENGTH }, (_, i) => i);
</script>

<div class="board {size}" role="group" aria-label={label}>
	{#each rows as row, r (r)}
		<div
			class="row"
			role="img"
			aria-label="{m.row(r + 1)}: {row.word
				? [...row.word].map((ch, i) => m.tile(ch, m.marks[row.marks[i]!]!)).join('; ')
				: row.marks.map((mk) => m.marks[mk]).join(', ')}"
		>
			{#each cols as i (i)}
				<span class="tile {row.marks[i]}" style:--i={i}>{row.word?.[i] ?? ''}</span>
			{/each}
		</div>
	{/each}
	{#if showTyping}
		{#key shake}
			<div class="row" class:shaking={shake > 0}>
				{#each cols as i (i)}
					<span class="tile" class:filled={!!current[i]}>{current[i] ?? ''}</span>
				{/each}
			</div>
		{/key}
	{/if}
	{#each { length: blank }, r}
		<div class="row" aria-hidden="true">
			{#each cols as i (i)}<span class="tile"></span>{/each}
		</div>
	{/each}
</div>

<style>
	.board {
		--hit: oklch(72% 0.17 150);
		--near: var(--gold);
		--miss: oklch(72% 0.02 280);
		display: grid;
		gap: 6px;
		width: 100%;
	}
	.row {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 6px;
	}
	.tile {
		display: grid;
		place-items: center;
		aspect-ratio: 1;
		border: var(--border);
		border-radius: 8px;
		background: var(--surface);
		--ink: var(--indigo);
		--ink-soft: var(--faded);
		--line: var(--indigo);
		--border: 1.5px solid var(--indigo);
		--stitch: 1.5px dashed var(--indigo);
		--good: #1d6a43;
		--danger: var(--madder);
		--warn: #855700;
		color: var(--ink);
		font-size: clamp(1.4rem, 7vw, 2.2rem);
		font-weight: 800;
		text-transform: uppercase;
		line-height: 1;
	}
	.tile.filled {
		animation: pop 120ms ease-out;
	}
	.tile.hit,
	.tile.near,
	.tile.miss {
		animation: flip 420ms ease-out backwards;
		animation-delay: calc(var(--i) * 90ms);
	}
	.tile.hit {
		background: var(--hit);
	}
	.tile.near {
		background: var(--near);
	}
	.tile.miss {
		background: var(--miss);
	}
	.shaking {
		animation: shake 360ms ease-in-out;
	}
	.sm {
		gap: 3px;
	}
	.sm .row {
		gap: 3px;
	}
	.sm .tile {
		border-width: 2px;
		border-radius: 4px;
		font-size: 0;
	}
	@keyframes flip {
		from {
			transform: rotateX(90deg);
		}
	}
	@keyframes pop {
		50% {
			transform: scale(1.08);
		}
	}
	@keyframes shake {
		20%,
		60% {
			transform: translateX(-8px);
		}
		40%,
		80% {
			transform: translateX(8px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.tile,
		.shaking {
			animation: none !important;
		}
	}
</style>
