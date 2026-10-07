<script lang="ts">
	import { untrack } from 'svelte';
	import { WORD_LENGTH, type WordRaceView } from '@games/wordrace';
	import FinalScores from '$lib/components/FinalScores.svelte';
	import LetterKeys from '$lib/components/LetterKeys.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import type { PlayerViewProps } from '$lib/games/types';
	import SittingOut from '$lib/components/SittingOut.svelte';
	import { t } from '$lib/i18n';
	import Board from './Board.svelte';

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
	const view = $derived(raw as WordRaceView);
	const you = $derived(view.you);
	const m = t.wordrace;
	const g = t.games;
	const next = () => onaction({ type: 'next' });

	let current = $state('');
	let tooShort = $state(false);
	/** Where things stood when we sent a guess, until the server answers. */
	let sent = $state<{ count: number; n: number } | null>(null);

	const round = $derived(view.round);
	const count = $derived(you?.guesses.length ?? 0);
	const rejectedN = $derived(you?.rejected?.n ?? 0);
	const done = $derived(!you || you.solved || you.out);
	const canType = $derived(view.phase === 'guess' && !done && sent === null);
	const rejected = $derived(you?.rejected && you.rejected.word === current ? you.rejected : null);

	// A new word starts with an empty row.
	$effect(() => {
		void round;
		untrack(() => {
			current = '';
			sent = null;
		});
	});

	// The server took the guess (clear the row) or refused it (keep it to fix).
	$effect(() => {
		const [c, n] = [count, rejectedN];
		untrack(() => {
			if (!sent) return;
			if (c > sent.count) current = '';
			if (c > sent.count || n > sent.n) sent = null;
		});
	});

	function type(letter: string) {
		if (!canType || current.length >= WORD_LENGTH) return;
		current += letter;
		tooShort = false;
	}

	function backspace() {
		if (!canType) return;
		current = current.slice(0, -1);
		tooShort = false;
	}

	function enter() {
		if (!canType) return;
		if (current.length < WORD_LENGTH) {
			tooShort = true;
			return;
		}
		sent = { count, n: rejectedN };
		onaction({ type: 'guess', word: current });
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.metaKey || e.ctrlKey || e.altKey || view.phase !== 'guess') return;
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
		if (e.key === 'Enter') enter();
		else if (e.key === 'Backspace') backspace();
		else if (/^[a-z]$/i.test(e.key)) type(e.key.toLowerCase());
		else return;
		e.preventDefault();
	}
</script>

<svelte:window {onkeydown} />

<section class="play">
	{#if !you && !audience && view.phase !== 'final'}<SittingOut />{/if}
	{#if view.phase === 'intro'}
		<div class="center">
			<h2 class="huge">{g.getReady}</h2>
			<p>{m.howTo}</p>
			<p class="muted">{m.legend}</p>
			<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} />
			{#if canControl}<button class="btn" onclick={next}>{g.startNow}</button>{/if}
		</div>
	{:else if view.phase === 'guess' || view.phase === 'reveal'}
		<header class="top">
			<p class="kicker">{m.wordOf(view.round + 1, view.rounds)}</p>
			{#if view.playerCount > 1}
				<p class="kicker">{m.done(view.doneCount, view.playerCount)}</p>
			{/if}
		</header>
		<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} />

		{#if you}
			<div class="board">
				<Board
					rows={you.guesses}
					typing={view.phase === 'guess' && !done}
					{current}
					shake={you.rejected?.n ?? 0}
					label={m.yourBoard}
				/>
			</div>
		{/if}

		<p class="status" aria-live="polite">
			{#if view.phase === 'reveal'}
				{m.theWordWas} <strong class="answer">{view.answer}</strong>
			{:else if you?.solved}
				<strong>{m.solvedIn(you.guesses.length)}</strong>
				<span class="points">{g.points(you.points)}</span>
			{:else if you?.out}
				<strong>{m.out}</strong>
			{:else if rejected}
				{m.notAWord(rejected.word)}
			{:else if tooShort}
				{m.tooShort}
			{/if}
			{#if view.phase === 'guess' && done && you && view.playerCount > 1}
				<span class="muted">{m.waiting}</span>
			{/if}
		</p>

		{#if view.phase === 'reveal' && you}
			<p class="score">
				{#if you.points > 0}<span class="points">{g.points(you.points)}</span>{/if}
				{t.trivia.scoreLine(you.score, you.rank ?? 1, view.leaderboard.length)}
			</p>
		{/if}

		{#if view.phase === 'guess' && you && !done}
			<LetterKeys
				marks={you.keys}
				disabled={!canType}
				onletter={type}
				onenter={enter}
				enterLabel={m.enter}
				onbackspace={backspace}
				backspaceLabel={m.backspace}
			/>
		{/if}

		{#if canControl}
			{#if view.phase === 'guess'}
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
		gap: 12px;
	}
	.kicker {
		font-weight: 700;
		color: var(--gold);
		text-transform: uppercase;
		letter-spacing: 0.16em;
		font-size: 0.9rem;
	}
	.board {
		width: min(100%, 330px);
		margin: 0 auto;
	}
	.status {
		display: grid;
		gap: 2px;
		min-height: 1.5em;
		font-weight: 700;
		text-align: center;
	}
	.answer {
		font-size: 1.6rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.score {
		display: grid;
		gap: 4px;
		text-align: center;
	}
	.points {
		font-size: 1.6rem;
		font-family: var(--display);
		font-weight: 400;
		color: var(--good);
	}
</style>
