<script lang="ts">
	import { t } from '$lib/i18n';

	interface FeedItem {
		n: number;
		player: { name: string } | null;
		kind: 'guess' | 'correct' | 'close';
		text: string;
	}

	/** Live guesses. Correct guesses show as "Ada guessed it!", never the answer. */
	let { feed, large = false }: { feed: FeedItem[]; large?: boolean } = $props();

	let list: HTMLOListElement;
	$effect(() => {
		void feed.length;
		list?.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
	});
</script>

<ol class="feed" class:large bind:this={list} aria-live="polite">
	{#if feed.length === 0}<li class="empty">{t.games.feedEmpty}</li>{/if}
	{#each feed as f (f.n)}
		<li class={f.kind}>
			{#if f.kind === 'correct'}
				<strong>{t.games.guessedIt(f.player?.name ?? '')}</strong>
			{:else if f.kind === 'close'}
				{f.text}
			{:else}
				<span class="who">{f.player?.name}:</span> {f.text}
			{/if}
		</li>
	{/each}
</ol>

<style>
	.feed {
		display: grid;
		align-content: start;
		gap: 4px;
		max-height: 220px;
		margin: 0;
		padding: 10px 12px;
		overflow-y: auto;
		border: var(--border);
		border-radius: var(--radius-sm);
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
		list-style: none;
	}
	.large {
		max-height: none;
		height: 100%;
		font-size: clamp(1rem, 1.6vw, 1.3rem);
	}
	li {
		overflow-wrap: anywhere;
	}
	.empty {
		color: var(--ink-soft);
	}
	.who {
		font-weight: 750;
	}
	.correct {
		color: var(--good);
	}
	.close {
		color: var(--warn);
		font-weight: 700;
	}
</style>
