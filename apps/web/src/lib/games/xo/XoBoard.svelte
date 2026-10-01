<script lang="ts">
	import type { Mark } from '@games/xo';
	import { t } from '$lib/i18n';

	interface Props {
		board: (Mark | null)[];
		winLine?: number[] | null;
		/** Set when it's this viewer's turn. */
		onmove?: (cell: number) => void;
		large?: boolean;
	}
	let { board, winLine = null, onmove, large = false }: Props = $props();
</script>

<div class="board" class:large class:live={!!onmove} role="group" aria-label="Board">
	{#each board as mark, i (i)}
		<button
			class="cell"
			class:win={winLine?.includes(i)}
			disabled={!onmove || mark !== null}
			aria-label={t.xo.cell(i, mark)}
			onclick={() => onmove?.(i)}
		>
			{#if mark}<span class="mark mark-{mark}">{mark}</span>{/if}
		</button>
	{/each}
</div>

<style>
	.board {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		grid-template-rows: repeat(3, 1fr);
		gap: 10px;
		width: min(100%, 360px);
		margin: 0 auto;
		aspect-ratio: 1;
	}
	.large {
		width: min(100%, calc(100dvh - 380px), 560px);
		gap: 16px;
	}
	.cell {
		display: grid;
		place-items: center;
		padding: 0;
		border: var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		box-shadow: var(--shadow);
		color: var(--ink);
		font: inherit;
		cursor: default;
		transition:
			transform 120ms ease-out,
			box-shadow 120ms ease-out,
			background-color 200ms ease-out;
		-webkit-tap-highlight-color: transparent;
	}
	.live .cell:not(:disabled) {
		cursor: pointer;
	}
	@media (hover: hover) {
		.live .cell:not(:disabled):hover {
			background: color-mix(in oklch, var(--yellow) 35%, var(--surface));
		}
	}
	.cell:active:not(:disabled) {
		transform: translate(3px, 3px);
		box-shadow: 1px 1px 0 var(--line);
	}
	.cell:focus-visible {
		transform: translate(-2px, -2px);
		box-shadow: var(--focus-shadow);
	}
	.win {
		background: var(--yellow);
	}
	.mark {
		font-size: clamp(2.6rem, 14vw, 4.5rem);
		font-weight: 800;
		line-height: 1;
		animation: drop 260ms cubic-bezier(0.3, 1.6, 0.5, 1);
	}
	.large .mark {
		font-size: clamp(3rem, 10vh, 7rem);
	}
	.mark-X {
		color: var(--pink);
		-webkit-text-stroke: 2px var(--ink);
	}
	.mark-O {
		color: var(--teal);
		-webkit-text-stroke: 2px var(--ink);
	}
	@keyframes drop {
		from {
			transform: scale(0.4);
			opacity: 0;
		}
	}
</style>
