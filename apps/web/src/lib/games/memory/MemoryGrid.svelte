<script lang="ts">
	import { t } from '$lib/i18n';

	let {
		size,
		lit = [],
		picks = [],
		pending = [],
		ontap,
		disabled = false,
		large = false
	}: {
		size: number;
		/** Tiles showing: the pattern while it shows, and at the reveal. */
		lit?: number[];
		picks?: { index: number; right: boolean }[];
		/** Tapped here but not confirmed by the server yet. */
		pending?: number[];
		/** Without it the grid is just for looking at (the big screen). */
		ontap?: (index: number) => void;
		disabled?: boolean;
		large?: boolean;
	} = $props();
	const m = t.memory;

	function state(i: number): 'right' | 'wrong' | 'pending' | 'lit' | '' {
		const pick = picks.find((p) => p.index === i);
		if (pick) return pick.right ? 'right' : 'wrong';
		if (pending.includes(i)) return 'pending';
		return lit.includes(i) ? 'lit' : '';
	}
	const label = (s: string) =>
		s === 'right' ? m.right : s === 'wrong' ? m.wrong : s === 'lit' ? m.lit : '';
</script>

<div class="grid" class:large style:--size={size} role="group" aria-label={m.grid}>
	{#each { length: size * size }, i (i)}
		{@const s = state(i)}
		{#if ontap}
			<button
				class="tile {s}"
				aria-label={m.tile(i, label(s))}
				disabled={disabled || s !== ''}
				onpointerdown={() => ontap(i)}
				onclick={(e) => e.detail === 0 && ontap(i)}
			></button>
		{:else}
			<span class="tile {s}" aria-hidden="true"></span>
		{/if}
	{/each}
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(var(--size), minmax(0, 1fr));
		gap: 6px;
		width: 100%;
		max-width: 420px;
		margin: 0 auto;
	}
	.large {
		max-width: min(58vh, 640px);
		gap: 10px;
	}
	.tile {
		aspect-ratio: 1;
		padding: 0;
		border: 2px solid var(--line);
		border-radius: 10px;
		background: var(--surface);
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
		transition: background-color 120ms ease-out;
	}
	button.tile:not(:disabled) {
		cursor: pointer;
	}
	.lit {
		background: var(--violet);
	}
	.pending {
		background: var(--yellow);
	}
	.right {
		background: var(--teal);
	}
	.wrong {
		background: oklch(70% 0.17 25);
	}
	@media (prefers-reduced-motion: reduce) {
		.tile {
			transition: none;
		}
	}
</style>
