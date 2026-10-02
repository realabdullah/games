<script lang="ts">
	import { MAX_GUESS_LENGTH, type EmojiView } from '@games/emoji';
	import FinalScores from '$lib/components/FinalScores.svelte';
	import GuessFeed from '$lib/components/GuessFeed.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import WordMask from '$lib/components/WordMask.svelte';
	import type { PlayerViewProps } from '$lib/games/types';
	import { t } from '$lib/i18n';

	let {
		view: raw,
		clockOffset,
		youId,
		audience,
		canControl,
		onaction,
		onplayagain,
		onendgame
	}: PlayerViewProps = $props();
	const view = $derived(raw as EmojiView);
	const you = $derived(view.you);
	const m = t.emoji;
	const g = t.games;
	const next = () => onaction({ type: 'next' });

	let guessText = $state('');
	function guess(e: SubmitEvent) {
		e.preventDefault();
		const text = guessText.trim();
		if (!text) return;
		onaction({ type: 'guess', text });
		guessText = '';
	}
</script>

<section class="play">
	{#if view.phase === 'intro'}
		<div class="center">
			<h2 class="huge">{g.getReady}</h2>
			<p>{m.howTo}</p>
			<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} />
			{#if canControl}<button class="btn" onclick={next}>{g.startNow}</button>{/if}
		</div>
	{:else if (view.phase === 'puzzle' || view.phase === 'reveal') && view.emoji}
		<header class="top">
			<p class="kicker">{m.puzzleOf(view.round + 1, view.rounds)}</p>
			<p class="category">{view.category}</p>
		</header>
		{#key view.round}
			<p class="emoji" role="img" aria-label="Emoji clue: {view.emoji}">{view.emoji}</p>
		{/key}
		<WordMask mask={view.mask} />
		<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} />

		{#if view.phase === 'puzzle'}
			{#if you?.guessed}
				<p class="got card">
					{m.youGotIt} <span class="points">{g.points(you.points)}</span>
				</p>
			{:else}
				<form class="guess" onsubmit={guess}>
					<label for="guess" class="sr-only">{m.guessPlaceholder}</label>
					<input
						id="guess"
						class="input"
						bind:value={guessText}
						maxlength={MAX_GUESS_LENGTH}
						placeholder={m.guessPlaceholder}
						autocomplete="off"
						autocapitalize="off"
						spellcheck="false"
						enterkeyhint="send"
					/>
					<button class="btn pink" disabled={!guessText.trim()}>{m.guess}</button>
				</form>
			{/if}
			<GuessFeed feed={view.feed} />
		{:else}
			<p class="answer">{m.answerWas} <strong>{view.answer}</strong></p>
			{#if you}
				<p class="score">
					{#if you.points > 0}<span class="points">{g.points(you.points)}</span>{/if}
					{t.trivia.scoreLine(you.score, you.rank ?? 1, view.leaderboard.length)}
				</p>
			{/if}
		{/if}

		{#if canControl}
			{#if view.phase === 'puzzle'}
				<button class="btn ghost small" onclick={next}>{g.skip}</button>
			{:else}
				<button class="btn pink" onclick={next}>{g.next}</button>
			{/if}
		{/if}
	{:else if view.phase === 'final'}
		<FinalScores
			leaderboard={view.leaderboard}
			youId={audience ? null : youId}
			{canControl}
			{onplayagain}
			{onendgame}
		/>
	{/if}
</section>

<style>
	.play {
		display: grid;
		gap: 14px;
	}
	.center {
		display: grid;
		gap: 14px;
		justify-items: center;
		padding: 24px 0;
		text-align: center;
	}
	.huge {
		font-size: clamp(2.4rem, 10vw, 3.5rem);
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}
	.kicker {
		font-weight: 750;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.9rem;
	}
	.category {
		padding: 2px 12px;
		border: 2px solid var(--line);
		border-radius: 999px;
		background: var(--yellow);
		font-weight: 800;
	}
	.emoji {
		font-size: clamp(3.2rem, 16vw, 4.8rem);
		line-height: 1.15;
		letter-spacing: 0.06em;
		text-align: center;
		animation: pop 450ms cubic-bezier(0.3, 1.5, 0.5, 1);
	}
	.guess {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 10px;
	}
	.got {
		padding: 14px;
		background: var(--teal);
		font-weight: 800;
		text-align: center;
	}
	.answer {
		font-size: 1.3rem;
		text-align: center;
	}
	.answer strong {
		text-transform: capitalize;
	}
	.score {
		display: grid;
		gap: 4px;
		text-align: center;
	}
	.points {
		font-weight: 800;
		color: oklch(40% 0.13 160);
	}
	.score .points {
		font-size: 1.6rem;
		color: oklch(45% 0.13 160);
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
