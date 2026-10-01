<script lang="ts">
	import type { TriviaAction, TriviaView } from '@games/trivia';
	import Timer from '$lib/components/Timer.svelte';
	import { t } from '$lib/i18n';
	import AnswerGrid from './AnswerGrid.svelte';
	import Leaderboard from './Leaderboard.svelte';

	/** A player's own screen: phone controller (party), online play, or solo. */
	interface Props {
		view: TriviaView;
		clockOffset: number;
		youId: string | null;
		audience?: boolean;
		/** Whether this viewer runs the game (online VIP, solo player). */
		canControl: boolean;
		onaction: (action: TriviaAction) => void;
		onplayagain?: () => void;
		onendgame?: () => void;
	}
	let {
		view,
		clockOffset,
		youId,
		audience = false,
		canControl,
		onaction,
		onplayagain,
		onendgame
	}: Props = $props();

	const m = t.trivia;
	const you = $derived(view.you);
	/** Joined after the game started: watch along, play the next one. */
	const spectating = $derived(view.you === null);
</script>

<section class="trivia">
	{#if view.phase === 'intro'}
		<div class="center">
			<p class="kicker">{view.packTitle}</p>
			<h2 class="huge">{m.getReady}</h2>
			<p class="muted">{m.questionsCount(view.total)}</p>
			<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} />
			{#if canControl}<button class="btn" onclick={() => onaction({ type: 'next' })}
					>{m.startNow}</button
				>{/if}
		</div>
	{:else if view.phase === 'question' && view.question}
		<p class="kicker">{m.questionOf(view.index + 1, view.total)}</p>
		<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} />
		<h2 class="q">{view.question.q}</h2>
		{#if spectating}<p class="muted">{m.nextRound}</p>{/if}
		<AnswerGrid
			choices={view.question.choices}
			picked={you?.answered ?? null}
			onpick={spectating ? undefined : (choice) => onaction({ type: 'answer', choice })}
		/>
		{#if you?.answered !== null && you?.answered !== undefined}
			<p class="waiting" aria-live="polite">
				{m.lockedIn}
				{#if !audience}<span class="muted">{m.answered(view.answeredCount, view.playerCount)}</span
					>{/if}
			</p>
		{/if}
		{#if canControl}<button class="btn ghost small" onclick={() => onaction({ type: 'next' })}
				>{m.skip}</button
			>{/if}
	{:else if view.phase === 'reveal' && view.question && view.reveal}
		{#if !spectating}
			<div
				class="result card"
				class:good={you?.correct === true}
				class:bad={you?.correct === false || you?.answered === null}
				aria-live="polite"
			>
				{#if you?.correct}
					<p class="big">{m.correct}</p>
					{#if !audience}<p class="points">+{you.points}</p>{/if}
				{:else if you?.answered === null}
					<p class="big">{m.tooSlow}</p>
				{:else}
					<p class="big">{m.wrong}</p>
				{/if}
				{#if !audience && you}
					<p>{m.scoreLine(you.score, you.rank ?? 1, view.leaderboard.length)}</p>
					{#if you.streak >= 2}<p class="streak">{m.streak(you.streak)}</p>{/if}
				{/if}
			</div>
		{/if}
		<p class="answer">
			{m.answerWas} <strong>{view.question.choices[view.reveal.answer]}</strong>
		</p>
		{#if view.reveal.fact}<p class="fact">{view.reveal.fact}</p>{/if}
		<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} />
		{#if canControl}
			<button class="btn pink" onclick={() => onaction({ type: 'next' })}>
				{view.index + 1 < view.total ? m.next : m.seeResults}
			</button>
		{/if}
	{:else if view.phase === 'final'}
		<div class="center">
			<p class="kicker">{m.finalTitle}</p>
			{#if !audience && you && !spectating}
				<h2 class="huge">{m.place(you.rank ?? 1)}</h2>
				<p class="big">{m.points(you.score)}</p>
			{:else}
				<h2 class="huge">{view.leaderboard[0]?.name} {m.wins}</h2>
			{/if}
		</div>
		<Leaderboard entries={view.leaderboard} {youId} showDelta={false} />
		{#if canControl}
			<div class="actions">
				<button class="btn pink" onclick={onplayagain}>{m.playAgain}</button>
				<button class="btn ghost" onclick={onendgame}>{m.backToLobby}</button>
			</div>
		{:else}
			<p class="muted center-text">{m.waitingForHost}</p>
		{/if}
	{/if}
</section>

<style>
	.trivia {
		display: grid;
		gap: 18px;
	}
	.center {
		display: grid;
		gap: 14px;
		justify-items: center;
		padding: 24px 0;
		text-align: center;
	}
	.center-text {
		text-align: center;
	}
	.kicker {
		font-weight: 750;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.9rem;
	}
	.huge {
		font-size: clamp(2.4rem, 10vw, 3.5rem);
	}
	.big {
		font-size: 1.6rem;
		font-weight: 800;
	}
	.q {
		font-size: clamp(1.4rem, 5vw, 2rem);
	}
	.waiting {
		display: grid;
		gap: 2px;
		font-weight: 750;
		text-align: center;
	}
	.result {
		display: grid;
		gap: 6px;
		justify-items: center;
		padding: 24px;
		text-align: center;
	}
	.good {
		background: var(--teal);
	}
	.bad {
		background: var(--pink);
	}
	.points {
		font-size: 2.4rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}
	.streak {
		font-weight: 750;
	}
	.answer {
		font-size: 1.15rem;
	}
	.fact {
		padding: 14px 16px;
		border-left: 6px solid var(--yellow);
		background: var(--surface);
		border-radius: var(--radius-sm);
	}
	.actions {
		display: grid;
		gap: 12px;
	}
</style>
