<script lang="ts">
	/** The jumbled letters as tiles. */
	let { letters, large = false }: { letters: string; large?: boolean } = $props();
</script>

<p class="letters" class:large aria-label={[...letters].join(' ').toUpperCase()}>
	{#each [...letters] as letter, i (i)}
		<span class="tile" aria-hidden="true" style:--i={i}>{letter}</span>
	{/each}
</p>

<style>
	.letters {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 6px;
	}
	.tile {
		display: grid;
		place-items: center;
		width: 1.6em;
		aspect-ratio: 1;
		border: var(--border);
		border-radius: 10px;
		background: var(--gold);
		--ink: var(--indigo);
		--ink-soft: var(--faded);
		--line: var(--indigo);
		--border: 1.5px solid var(--indigo);
		--stitch: 1.5px dashed var(--indigo);
		--good: #1d6a43;
		--danger: var(--madder);
		--warn: #855700;
		color: var(--ink);
		box-shadow: 0 3px 0 var(--line);
		font-size: clamp(1.4rem, 8vw, 2.2rem);
		font-weight: 800;
		text-transform: uppercase;
	}
	.large {
		gap: 12px;
	}
	.large .tile {
		font-size: clamp(2.4rem, 6vw, 5rem);
	}
	@media (prefers-reduced-motion: no-preference) {
		.tile {
			animation: drop 350ms cubic-bezier(0.3, 1.5, 0.5, 1) backwards;
			animation-delay: calc(var(--i) * 40ms);
		}
	}
	@keyframes drop {
		from {
			transform: translateY(-12px);
			opacity: 0;
		}
	}
</style>
