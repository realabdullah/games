<script lang="ts">
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

	// Shapes as well as colors, so choices are distinguishable without color.
	const looks = [
		{ shape: '▲', color: 'var(--pink)' },
		{ shape: '◆', color: 'var(--teal)' },
		{ shape: '●', color: 'var(--yellow)' },
		{ shape: '■', color: 'var(--violet)' }
	];
	const revealed = $derived(correct !== null);
	const disabled = $derived(!onpick || picked !== null || revealed);
	const maxCount = $derived(Math.max(1, ...(counts ?? [])));
</script>

<div class="grid" class:large class:two={choices.length === 2}>
	{#each choices as choice, i (i)}
		{@const look = looks[i % looks.length]!}
		<button
			class="choice"
			style:--c={look.color}
			class:picked={picked === i}
			class:right={revealed && correct === i}
			class:dim={revealed ? correct !== i : picked !== null && picked !== i}
			{disabled}
			aria-pressed={picked === i}
			onclick={() => onpick?.(i)}
		>
			<span class="shape" aria-hidden="true">{look.shape}</span>
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
		gap: 12px;
	}
	@media (min-width: 560px) {
		.grid {
			grid-template-columns: 1fr 1fr;
		}
	}
	.large {
		gap: 20px;
	}
	.choice {
		position: relative;
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 14px;
		min-height: 72px;
		padding: 14px 18px;
		border: var(--border);
		border-radius: var(--radius);
		background: var(--c);
		color: var(--ink);
		box-shadow: var(--shadow);
		font: inherit;
		font-size: 1.2rem;
		font-weight: 750;
		text-align: left;
		cursor: pointer;
		transition:
			transform 120ms ease-out,
			opacity 200ms ease-out,
			box-shadow 120ms ease-out;
		-webkit-tap-highlight-color: transparent;
	}
	.large .choice {
		min-height: 110px;
		font-size: clamp(1.4rem, 2.6vw, 2.2rem);
	}
	.choice:disabled {
		cursor: default;
	}
	.choice:active:not(:disabled) {
		transform: translate(3px, 3px);
		box-shadow: 1px 1px 0 var(--line);
	}
	/* Your pick: a thick ink ring, distinct from the violet focus lift. */
	.picked {
		box-shadow:
			0 0 0 3px var(--bg),
			0 0 0 7px var(--ink);
	}
	.choice:focus-visible {
		transform: translate(-2px, -2px);
		box-shadow: var(--focus-shadow);
	}
	.dim {
		opacity: 0.4;
	}
	.right {
		transform: scale(1.02);
	}
	.shape {
		font-size: 1.3em;
		line-height: 1;
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
		border-radius: 999px;
		background: var(--ink);
		transform-origin: left;
		transition: scale 500ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.n {
		font-variant-numeric: tabular-nums;
	}
	.tick {
		position: absolute;
		top: -14px;
		right: -10px;
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border: var(--border);
		border-radius: 50%;
		background: var(--surface);
		font-size: 1.2rem;
	}
</style>
