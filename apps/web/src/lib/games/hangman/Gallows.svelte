<script lang="ts">
	import { t } from '$lib/i18n';

	/** The classic drawing: one more part for every wrong guess. */
	let { misses, max }: { misses: number; max: number } = $props();

	const PARTS = [
		{ kind: 'circle', cx: 80, cy: 36, r: 10 },
		{ kind: 'line', d: 'M80 46 V82' },
		{ kind: 'line', d: 'M80 56 L66 70' },
		{ kind: 'line', d: 'M80 56 L94 70' },
		{ kind: 'line', d: 'M80 82 L68 104' },
		{ kind: 'line', d: 'M80 82 L92 104' }
	] as const;
</script>

<svg
	class="gallows"
	class:lost={misses >= max}
	viewBox="0 0 120 140"
	role="img"
	aria-label={t.hangman.gallows(misses, max)}
>
	<path class="frame" d="M10 132 H100 M30 132 V10 H80 V26" />
	{#each PARTS.slice(0, misses) as part, i (i)}
		{#if part.kind === 'circle'}
			<circle class="part" cx={part.cx} cy={part.cy} r={part.r} pathLength="1" />
		{:else}
			<path class="part" d={part.d} pathLength="1" />
		{/if}
	{/each}
</svg>

<style>
	.gallows {
		width: 100%;
		height: auto;
		overflow: visible;
	}
	path,
	circle {
		fill: none;
		stroke: var(--ink);
		stroke-width: 5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.part {
		stroke: var(--danger);
		stroke-dasharray: 1;
		animation: draw 450ms ease-out backwards;
	}
	.lost .part {
		stroke: var(--ink);
	}
	@keyframes draw {
		from {
			stroke-dashoffset: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.part {
			animation: none;
		}
	}
</style>
