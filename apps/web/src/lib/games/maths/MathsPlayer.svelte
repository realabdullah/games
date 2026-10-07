<script lang="ts">
	import { MAX_ANSWER_LENGTH, MAX_TRIES, type MathsView } from '@games/maths';
	import FinalScores from '$lib/components/FinalScores.svelte';
	import SittingOut from '$lib/components/SittingOut.svelte';
	import Timer from '$lib/components/Timer.svelte';
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
	const view = $derived(raw as MathsView);
	const you = $derived(view.you);
	const lastWrong = $derived(you?.wrong.at(-1));
	const m = t.maths;
	const g = t.games;
	const next = () => onaction({ type: 'next' });

	let answerText = $state('');
	function send(e: SubmitEvent) {
		e.preventDefault();
		const value = answerText.trim();
		if (!value) return;
		onaction({ type: 'answer', value });
		answerText = '';
	}

	/** Each new sum is ready to type into, so nobody loses time tapping the box. */
	function focus(node: HTMLInputElement) {
		node.focus();
	}
</script>

<section class="play">
	{#if !you && !audience && view.phase !== 'final'}<SittingOut />{/if}
	{#if view.phase === 'intro'}
		<div class="center">
			<h2 class="huge">{g.getReady}</h2>
			<p>{m.howTo}</p>
			<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} />
			{#if canControl}<button class="btn" onclick={next}>{g.startNow}</button>{/if}
		</div>
	{:else if (view.phase === 'sum' || view.phase === 'reveal') && view.sum}
		<header class="top">
			<p class="kicker">{m.sumOf(view.round + 1, view.rounds)}</p>
			{#if view.phase === 'sum'}<p class="count">
					{m.solved(view.solvedCount, view.playerCount)}
				</p>{/if}
		</header>
		{#key view.round}
			<p class="sum">
				{view.sum} <span class="soft">=</span>
				{#if view.answer !== null}<span class="answer">{view.answer.toLocaleString('en')}</span
					>{/if}
			</p>
		{/key}
		<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} />

		{#if view.phase === 'sum' && you}
			{#if you.solved}
				<p class="got card">{m.correct} <span class="points">{g.points(you.points)}</span></p>
			{:else if you.triesLeft <= 0}
				<p class="out card">{m.out}</p>
			{:else}
				{#key view.round}
					<form class="answer-form" onsubmit={send}>
						<label for="answer" class="sr-only">{m.answerLabel}</label>
						<input
							id="answer"
							class="input"
							bind:value={answerText}
							use:focus
							inputmode="numeric"
							pattern="[0-9,\s]*"
							maxlength={MAX_ANSWER_LENGTH}
							placeholder="?"
							autocomplete="off"
							enterkeyhint="send"
						/>
						<button class="btn primary" disabled={!answerText.trim()}>{m.send}</button>
					</form>
				{/key}
				{#if lastWrong !== undefined}
					<p class="wrong" role="status">
						{m.notIt(lastWrong)} · {m.triesLeft(you.triesLeft)}
					</p>
				{:else}
					<p class="hint">{m.triesLeft(MAX_TRIES)}</p>
				{/if}
			{/if}
		{:else if view.phase === 'reveal' && you}
			<p class="score">
				{#if you.points > 0}<span class="points">{g.points(you.points)}</span>{/if}
				{t.trivia.scoreLine(you.score, you.rank ?? 1, view.leaderboard.length)}
			</p>
		{/if}

		{#if canControl}
			{#if view.phase === 'sum'}
				<button class="btn ghost small" onclick={next}>{g.skip}</button>
			{:else}
				<button class="btn primary" onclick={next}>{g.next}</button>
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
		font-weight: 700;
		color: var(--gold);
		text-transform: uppercase;
		letter-spacing: 0.16em;
		font-size: 0.9rem;
	}
	.count {
		font-weight: 750;
	}
	.sum {
		font-size: clamp(2.6rem, 13vw, 4rem);
		font-weight: 800;
		line-height: 1.15;
		text-align: center;
		font-variant-numeric: tabular-nums;
		animation: pop 400ms cubic-bezier(0.3, 1.5, 0.5, 1);
	}
	.soft {
		color: var(--ink-soft);
	}
	.answer {
		color: var(--good);
	}
	.answer-form {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 10px;
	}
	.answer-form .input {
		font-size: 1.6rem;
		font-weight: 800;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}
	.got,
	.out {
		padding: 14px;
		font-weight: 800;
		text-align: center;
	}
	.got {
		background: var(--leaf);
		--ink: var(--indigo);
		--ink-soft: var(--faded);
		--line: var(--indigo);
		--border: 1.5px solid var(--indigo);
		--stitch: 1.5px dashed var(--indigo);
		--good: #1d6a43;
		--danger: var(--madder);
		--warn: #855700;
		color: var(--ink);
	}
	.out {
		color: var(--ink-soft);
	}
	.wrong,
	.hint {
		text-align: center;
	}
	.wrong {
		font-weight: 750;
		color: var(--danger);
	}
	.hint {
		color: var(--ink-soft);
	}
	.score {
		display: grid;
		gap: 4px;
		text-align: center;
	}
	.points {
		font-family: var(--display);
		font-weight: 400;
		color: var(--good);
	}
	.score .points {
		font-size: 1.6rem;
		color: var(--good);
	}
	@keyframes pop {
		from {
			transform: scale(0.6);
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.sum {
			animation: none;
		}
	}
</style>
