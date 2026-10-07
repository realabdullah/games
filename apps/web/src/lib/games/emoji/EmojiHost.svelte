<script lang="ts">
	import type { EmojiView } from '@games/emoji';
	import FinalScores from '$lib/components/FinalScores.svelte';
	import GuessFeed from '$lib/components/GuessFeed.svelte';
	import Leaderboard from '$lib/components/Leaderboard.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import WordMask from '$lib/components/WordMask.svelte';
	import type { HostViewProps } from '$lib/games/types';
	import { t } from '$lib/i18n';

	let { view: raw, clockOffset, onaction, onplayagain, onendgame }: HostViewProps = $props();
	const view = $derived(raw as EmojiView);
	const m = t.emoji;
	const g = t.games;
	const next = () => onaction({ type: 'next' });
</script>

<section class="host">
	{#if view.phase === 'intro'}
		<div class="center">
			<h2 class="title">Emoji Riddles</h2>
			<p class="big">{m.howTo}</p>
			<p class="example" aria-hidden="true">🌧️🎀 → rainbow</p>
			<div class="timer">
				<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} large />
			</div>
			<button class="btn" onclick={next}>{g.startNow}</button>
		</div>
	{:else if (view.phase === 'puzzle' || view.phase === 'reveal') && view.emoji}
		<header class="top">
			<p class="kicker">{m.puzzleOf(view.round + 1, view.rounds)}</p>
			<p class="category">{view.category}</p>
		</header>
		<div class="stage">
			<div class="main">
				{#key view.round}
					<p class="emoji" role="img" aria-label="Emoji clue: {view.emoji}">{view.emoji}</p>
				{/key}
				<WordMask mask={view.mask} large />
				{#if view.phase === 'puzzle'}
					<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} large />
					<p class="count">{m.got(view.guessedCount, view.playerCount)}</p>
				{/if}
			</div>
			<aside class="side" class:feed={view.phase === 'puzzle'}>
				{#if view.phase === 'puzzle'}
					<GuessFeed feed={view.feed} large />
				{:else}
					<Leaderboard entries={view.leaderboard} limit={5} />
				{/if}
			</aside>
		</div>
		<footer>
			{#if view.phase === 'puzzle'}
				<button class="btn ghost small" onclick={next}>{g.skip}</button>
			{:else}
				<button class="btn primary" onclick={next}>{g.next}</button>
			{/if}
		</footer>
	{:else if view.phase === 'final'}
		<FinalScores leaderboard={view.leaderboard} canControl large {onplayagain} {onendgame} />
	{/if}
</section>

<style>
	.host {
		display: grid;
		gap: clamp(14px, 2vw, 24px);
	}
	.center {
		display: grid;
		gap: 16px;
		justify-items: center;
		padding: 4vh 0;
		text-align: center;
	}
	.timer {
		width: min(100%, 600px);
	}
	.title {
		font-size: clamp(2.6rem, 7vw, 5rem);
	}
	.big {
		max-width: 30ch;
		font-size: clamp(1.4rem, 2.6vw, 2.2rem);
		font-family: var(--display);
		font-weight: 400;
	}
	.example {
		font-size: clamp(1.3rem, 2.4vw, 2rem);
		font-weight: 750;
		color: var(--ink-soft);
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 16px;
	}
	.kicker {
		font-weight: 700;
		color: var(--gold);
		text-transform: uppercase;
		letter-spacing: 0.16em;
		font-size: clamp(1rem, 1.6vw, 1.3rem);
	}
	.category {
		padding: 4px 16px;
		border: var(--border);
		border-radius: var(--radius-sm);
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
		font-size: clamp(1.1rem, 2vw, 1.6rem);
		font-weight: 800;
	}
	.stage {
		display: grid;
		gap: 24px;
	}
	@media (min-width: 960px) {
		.stage {
			grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
			min-height: calc(100dvh - 300px);
		}
	}
	.main {
		display: grid;
		gap: clamp(16px, 3vh, 32px);
		align-content: center;
		justify-items: center;
		text-align: center;
	}
	.emoji {
		font-size: clamp(4rem, 12vw, 10rem);
		line-height: 1.1;
		letter-spacing: 0.08em;
		animation: pop 500ms cubic-bezier(0.3, 1.5, 0.5, 1);
	}
	.count {
		font-size: clamp(1.1rem, 2vw, 1.6rem);
		font-weight: 750;
	}
	.side {
		display: grid;
		align-content: start;
	}
	.side.feed {
		align-content: stretch;
		min-height: 240px;
	}
	footer {
		display: flex;
		justify-content: center;
	}
	@keyframes pop {
		from {
			transform: scale(0.6);
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.emoji {
			animation: none;
		}
	}
</style>
