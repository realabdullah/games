<script lang="ts">
	import type { TriviaAction, TriviaView } from '@games/trivia';
	import Timer from '$lib/components/Timer.svelte';
	import { t } from '$lib/i18n';
	import AnswerGrid from './AnswerGrid.svelte';
	import Leaderboard from './Leaderboard.svelte';

	/** The shared big screen in party mode. Built to be read from across a room. */
	interface Props {
		view: TriviaView;
		clockOffset: number;
		onaction: (action: TriviaAction) => void;
		onplayagain: () => void;
		onendgame: () => void;
	}
	let { view, clockOffset, onaction, onplayagain, onendgame }: Props = $props();

	const m = t.trivia;
</script>

<section class="host">
	{#if view.phase === 'intro'}
		<div class="center">
			<p class="kicker">{m.questionsCount(view.total)}</p>
			<h2 class="title">{view.packTitle}</h2>
			<p class="big">{m.getReady}</p>
			<div class="timer">
				<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} large />
			</div>
			<button class="btn" onclick={() => onaction({ type: 'next' })}>{m.startNow}</button>
		</div>
	{:else if view.question && (view.phase === 'question' || view.phase === 'reveal')}
		<header class="top">
			<p class="kicker">{m.questionOf(view.index + 1, view.total)}</p>
			{#if view.phase === 'question'}
				<p class="answered" aria-live="polite">
					{m.answered(view.answeredCount, view.playerCount)}
				</p>
			{/if}
		</header>
		<h2 class="q">{view.question.q}</h2>
		<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} large />
		<AnswerGrid
			choices={view.question.choices}
			correct={view.reveal?.answer ?? null}
			counts={view.reveal?.counts ?? null}
			large
		/>

		{#if view.phase === 'reveal' && view.reveal}
			<div class="after">
				<div class="notes">
					{#if view.reveal.fact}<p class="fact">{view.reveal.fact}</p>{/if}
					{#if view.reveal.audienceCorrectPct !== null}
						<p class="muted">{m.audienceGot(view.reveal.audienceCorrectPct)}</p>
					{/if}
				</div>
				<Leaderboard entries={view.leaderboard} limit={5} large />
			</div>
			<footer class="controls">
				<button class="btn pink" onclick={() => onaction({ type: 'next' })}>
					{view.index + 1 < view.total ? m.next : m.seeResults}
				</button>
			</footer>
		{:else}
			<footer class="controls">
				<button class="btn ghost small" onclick={() => onaction({ type: 'next' })}>{m.skip}</button>
			</footer>
		{/if}
	{:else if view.phase === 'final'}
		<div class="center">
			<p class="kicker">{m.finalTitle}</p>
			{#if view.leaderboard[0]}
				<p class="winner-avatar" aria-hidden="true">{view.leaderboard[0].avatar}</p>
				<h2 class="title">{view.leaderboard[0].name} {m.wins}</h2>
			{/if}
		</div>
		<div class="final-board">
			<Leaderboard entries={view.leaderboard} showDelta={false} large />
		</div>
		<footer class="controls">
			<button class="btn pink" onclick={onplayagain}>{m.playAgain}</button>
			<button class="btn ghost" onclick={onendgame}>{m.backToLobby}</button>
		</footer>
	{/if}
</section>

<style>
	.host {
		display: grid;
		gap: clamp(16px, 2.5vw, 28px);
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
	.kicker {
		font-weight: 750;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: clamp(1rem, 1.6vw, 1.3rem);
	}
	.title {
		font-size: clamp(3rem, 8vw, 6rem);
	}
	.big {
		font-size: clamp(1.6rem, 3vw, 2.4rem);
		font-weight: 750;
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 16px;
	}
	.answered {
		font-size: clamp(1.1rem, 2vw, 1.6rem);
		font-weight: 750;
	}
	.q {
		font-size: clamp(2rem, 4.5vw, 3.6rem);
	}
	.after {
		display: grid;
		grid-template-columns: 1fr;
		gap: 24px;
	}
	@media (min-width: 900px) {
		.after {
			grid-template-columns: 1fr 1fr;
		}
	}
	.notes {
		display: grid;
		align-content: start;
		gap: 12px;
		font-size: clamp(1.1rem, 1.8vw, 1.5rem);
	}
	.fact {
		padding: 16px 20px;
		border-left: 8px solid var(--yellow);
		border-radius: var(--radius-sm);
		background: var(--surface);
	}
	.winner-avatar {
		font-size: clamp(5rem, 12vw, 9rem);
		line-height: 1;
	}
	.final-board {
		width: min(100%, 760px);
		margin: 0 auto;
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 14px;
	}
</style>
