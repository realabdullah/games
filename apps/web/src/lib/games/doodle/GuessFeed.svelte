<script lang="ts">
	import type { DoodleView } from '@games/doodle';
	import { t } from '$lib/i18n';

	/** Live guesses. Correct guesses show as "Ada guessed it!", never the word. */
	let { feed, large = false }: { feed: DoodleView['feed']; large?: boolean } = $props();

	let list: HTMLOListElement;
	$effect(() => {
		void feed.length;
		list?.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
	});
</script>

<ol class="feed" class:large bind:this={list} aria-live="polite">
	{#if feed.length === 0}<li class="empty">{t.doodle.feedEmpty}</li>{/if}
	{#each feed as f (f.n)}
		<li class={f.kind}>
			{#if f.kind === 'correct'}
				<strong>{t.doodle.guessedIt(f.player?.name ?? '')}</strong>
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
		color: oklch(45% 0.13 160);
	}
	.close {
		color: oklch(50% 0.15 60);
		font-weight: 700;
	}
</style>
