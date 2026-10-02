<script lang="ts">
	/** A word with hidden letters as blanks, e.g. ["_", "a", " ", "_"]. Words wrap as a whole. */
	let { mask, large = false }: { mask: string[]; large?: boolean } = $props();

	const words = $derived(
		mask
			.join('')
			.split(' ')
			.map((w) => [...w])
	);
	/** Long words shrink to fit the width instead of overflowing. */
	const longest = $derived(Math.max(4, ...words.map((w) => w.length)));
	/** Read out as "blank c blank, c blank blank…". */
	const spoken = $derived(
		words.map((w) => w.map((c) => (c === '_' ? 'blank' : c)).join(' ')).join(', ')
	);
</script>

<div class="fit">
	<p class="mask" class:large style:--n={longest}>
		<span class="sr-only">{spoken}</span>
		{#each words as word, w (w)}
			<span class="word" aria-hidden="true">
				{#each word as ch, i (i)}
					<span class="ch" class:letter={/[\p{L}\p{N}_]/u.test(ch)} class:shown={ch !== '_'}
						>{ch === '_' ? '' : ch}</span
					>
				{/each}
			</span>
		{/each}
	</p>
</div>

<style>
	.fit {
		width: 100%;
		container-type: inline-size;
	}
	.mask {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.3em 0.9em;
		/* Each letter takes about 1.15em, so the longest word always fits on one line. */
		font-size: min(1.8rem, 100cqi / (var(--n) * 1.2));
		font-weight: 800;
		text-transform: uppercase;
	}
	.large {
		font-size: min(clamp(2rem, 4.4vw, 4rem), 100cqi / (var(--n) * 1.2));
	}
	.word {
		display: flex;
		gap: 0.28em;
	}
	.ch {
		min-width: 0.6em;
		text-align: center;
		line-height: 1.15;
	}
	.letter {
		min-width: 0.85em;
		border-bottom: 0.12em solid var(--ink);
	}
	.letter.shown {
		animation: pop 350ms cubic-bezier(0.3, 1.5, 0.5, 1);
	}
	@keyframes pop {
		from {
			transform: translateY(-0.3em);
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.letter.shown {
			animation: none;
		}
	}
</style>
