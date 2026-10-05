<script lang="ts">
	let {
		cells,
		size,
		answer = null,
		misses = [],
		ontap,
		disabled = false,
		large = false
	}: {
		cells: string[];
		size: number;
		/** Highlighted at the reveal. */
		answer?: number | null;
		misses?: number[];
		/** Without it the grid is just for looking at (the big screen). */
		ontap?: (index: number) => void;
		disabled?: boolean;
		large?: boolean;
	} = $props();
</script>

<div class="grid" class:large class:frozen={disabled} style:--size={size}>
	{#each cells as cell, i (i)}
		{#if ontap}
			<button
				class="cell"
				class:answer={answer === i}
				class:miss={misses.includes(i)}
				disabled={disabled || answer !== null}
				onpointerdown={() => ontap(i)}
				onclick={(e) => e.detail === 0 && ontap(i)}>{cell}</button
			>
		{:else}
			<span class="cell" class:answer={answer === i}>{cell}</span>
		{/if}
	{/each}
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(var(--size), minmax(0, 1fr));
		gap: 4px;
		width: 100%;
		max-width: 480px;
		margin: 0 auto;
		/* Smaller glyphs for bigger grids, so two-digit numbers still fit. */
		font-size: calc(min(92vw, 480px) / var(--size) * 0.42);
	}
	.large {
		max-width: min(60vh, 680px);
		font-size: calc(min(60vh, 680px) / var(--size) * 0.42);
	}
	.cell {
		display: grid;
		place-items: center;
		aspect-ratio: 1;
		padding: 0;
		border: 2px solid var(--line);
		border-radius: 10px;
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 800;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		touch-action: manipulation;
		user-select: none;
		-webkit-user-select: none;
		-webkit-tap-highlight-color: transparent;
	}
	button.cell {
		cursor: pointer;
	}
	button.cell:active:not(:disabled) {
		background: var(--yellow);
	}
	.frozen .cell {
		opacity: 0.5;
	}
	.miss {
		background: oklch(85% 0.08 25);
	}
	.answer {
		background: var(--teal);
		outline: 4px solid var(--ink);
		outline-offset: -2px;
		opacity: 1;
	}
	@media (prefers-reduced-motion: no-preference) {
		.answer {
			animation: pop 400ms cubic-bezier(0.3, 1.5, 0.5, 1);
		}
	}
	@keyframes pop {
		50% {
			transform: scale(1.15);
		}
	}
</style>
