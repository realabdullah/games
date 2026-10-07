<script lang="ts">
	import Motif from '$lib/components/Motif.svelte';

	interface Props {
		choices: string[];
		/** The choice this viewer picked, if any. */
		picked?: number | null;
		/** Set once revealed. */
		correct?: number | null;
		/** Votes per choice, shown on reveal. */
		counts?: number[] | null;
		onpick?: (choice: number) => void;
		large?: boolean;
	}
	let {
		choices,
		picked = null,
		correct = null,
		counts = null,
		onpick,
		large = false
	}: Props = $props();

	// Each choice has its own motif, so they differ by pattern, not colour alone.
	const motifs = ['sun', 'stripes', 'diamonds', 'dots'];
	const revealed = $derived(correct !== null);
	const disabled = $derived(!onpick || picked !== null || revealed);
	const maxCount = $derived(Math.max(1, ...(counts ?? [])));
</script>

<div class="grid" class:large class:two={choices.length === 2}>
	{#each choices as choice, i (i)}
		<button
			class="choice"
			class:picked={picked === i}
			class:right={revealed && correct === i}
			class:dim={revealed ? correct !== i : picked !== null && picked !== i}
			{disabled}
			aria-pressed={picked === i}
			onclick={() => onpick?.(i)}
		>
			<Motif id={motifs[i % motifs.length]!} />
			<span class="text">{choice}</span>
			{#if revealed && counts}
				<span class="count" aria-label="{counts[i]} answers">
					<span class="bar" style:scale="{(counts[i] ?? 0) / maxCount} 1"></span>
					<span class="n">{counts[i]}</span>
				</span>
			{/if}
			{#if revealed && correct === i}<span class="tick" aria-label="Correct answer">✓</span>{/if}
		</button>
	{/each}
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 10px;
	}
	@media (min-width: 560px) {
		.grid {
			grid-template-columns: 1fr 1fr;
		}
	}
	.large {
		gap: 18px;
	}
	.choice {
		--ink: var(--indigo);
		--ink-soft: var(--faded);
		--line: var(--indigo);
		position: relative;
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 14px;
		min-height: 68px;
		padding: 12px 16px 12px 12px;
		border: 0;
		border-radius: var(--radius);
		background: var(--starch);
		color: var(--ink);
		font: inherit;
		font-size: 1.2rem;
		font-weight: 700;
		text-align: left;
		cursor: pointer;
		transition:
			transform 120ms ease-out,
			opacity 200ms ease-out,
			background-color 160ms ease-out;
		-webkit-tap-highlight-color: transparent;
	}
	.choice > :global(.motif) {
		font-size: 2.6rem;
	}
	.large .choice {
		min-height: 110px;
		padding-left: 18px;
		font-size: clamp(1.4rem, 2.6vw, 2.2rem);
	}
	.large .choice > :global(.motif) {
		font-size: clamp(3rem, 5vw, 4.5rem);
	}
	.choice:disabled {
		cursor: default;
	}
	.choice:active:not(:disabled) {
		transform: scale(0.98);
	}
	/* Your pick: gold cloth with a stitched edge. */
	.picked {
		background: var(--gold);
		outline: 2.5px dashed var(--starch);
		outline-offset: 4px;
	}
	.choice:focus-visible {
		outline: 2.5px dashed var(--gold);
		outline-offset: 4px;
	}
	.dim {
		opacity: 0.4;
	}
	.right {
		background: var(--gold);
		transform: scale(1.02);
	}
	.text {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.count {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 70px;
	}
	.bar {
		flex: 1;
		height: 10px;
		border-radius: var(--radius-sm);
		background: var(--ink);
		transform-origin: left;
		transition: scale 500ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.n {
		font-variant-numeric: tabular-nums;
	}
	.tick {
		position: absolute;
		top: -12px;
		right: -8px;
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--indigo);
		color: var(--gold);
		font-size: 1.2rem;
	}
</style>
