<script lang="ts">
	import { MAX_SOLVE_LENGTH, type HangmanView } from '@games/hangman';
	import FinalScores from '$lib/components/FinalScores.svelte';
	import LetterKeys from '$lib/components/LetterKeys.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import WordMask from '$lib/components/WordMask.svelte';
	import type { PlayerViewProps } from '$lib/games/types';
	import SittingOut from '$lib/components/SittingOut.svelte';
	import { t } from '$lib/i18n';
	import { eventText } from './event';
	import Gallows from './Gallows.svelte';

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
	const view = $derived(raw as HangmanView);
	const you = $derived(view.you);
	const m = t.hangman;
	const g = t.games;
	const next = () => onaction({ type: 'next' });

	const yourTurn = $derived(!!you?.yourTurn);
	const youreNext = $derived(!yourTurn && !!youId && view.upNext?.id === youId);
	const marks = $derived(
		Object.fromEntries(
			view.guessed.map((ch) => [ch, view.wrong.includes(ch) ? 'miss' : 'hit'] as const)
		)
	);

	let solving = $state(false);
	let solveText = $state('');
	$effect(() => {
		if (!yourTurn) solving = false;
	});

	function solve(e: SubmitEvent) {
		e.preventDefault();
		const text = solveText.trim();
		if (!text) return;
		onaction({ type: 'solve', text });
		solveText = '';
		solving = false;
	}

	function onkeydown(e: KeyboardEvent) {
		if (!yourTurn || solving || e.metaKey || e.ctrlKey || e.altKey) return;
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
		const ch = e.key.toLowerCase();
		if (!/^[a-z]$/.test(ch) || view.guessed.includes(ch)) return;
		e.preventDefault();
		onaction({ type: 'letter', letter: ch });
	}
</script>

<svelte:window {onkeydown} />

<section class="play">
	{#if !you && !audience && view.phase !== 'final'}<SittingOut />{/if}
	{#if view.phase === 'intro'}
		<div class="center">
			<h2 class="huge">{g.getReady}</h2>
			<p>{m.howTo}</p>
			<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} />
			{#if canControl}<button class="btn" onclick={next}>{g.startNow}</button>{/if}
		</div>
	{:else if view.phase === 'turn' || view.phase === 'reveal'}
		<header class="top">
			<p class="kicker">{m.wordOf(view.round + 1, view.rounds)}</p>
			<p class="category">{view.category}</p>
		</header>

		<div class="board">
			<div class="drawing">
				<Gallows misses={view.misses} max={view.maxMisses} />
			</div>
			<div class="side">
				<p class="lives">{m.lives(view.maxMisses - view.misses)}</p>
				{#if view.wrong.length}
					<p class="wrong" aria-label="Wrong letters: {view.wrong.join(', ')}">
						{#each view.wrong as ch (ch)}<span>{ch}</span>{/each}
					</p>
				{/if}
			</div>
		</div>
		<WordMask mask={view.mask} />

		{#if view.phase === 'turn'}
			<p class="banner" class:mine={yourTurn} aria-live="polite">
				{#if yourTurn}
					{m.yourTurn}
				{:else if view.turn}
					{m.turn(view.turn.name)}{#if youreNext}<span class="muted"> · {m.youreNext}</span>{/if}
				{/if}
			</p>
			<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} />
			{#if view.event}
				{#key view.event.n}
					<p class="event {view.event.kind}">{eventText(view.event, youId)}</p>
				{/key}
			{/if}

			{#if yourTurn && solving}
				<form class="solve" onsubmit={solve}>
					<label for="solve" class="sr-only">{m.solvePlaceholder}</label>
					<!-- svelte-ignore a11y_autofocus -->
					<input
						id="solve"
						class="input"
						bind:value={solveText}
						maxlength={MAX_SOLVE_LENGTH}
						placeholder={m.solvePlaceholder}
						autocomplete="off"
						autocapitalize="off"
						spellcheck="false"
						enterkeyhint="send"
						autofocus
					/>
					<button class="btn primary" disabled={!solveText.trim()}>{m.solve}</button>
					<button type="button" class="btn ghost small" onclick={() => (solving = false)}>
						{m.cancel}
					</button>
				</form>
			{:else if you}
				<LetterKeys
					{marks}
					used={view.guessed}
					disabled={!yourTurn}
					label={(ch) =>
						m.letter(
							ch,
							marks[ch] === 'hit' ? m.hitState : marks[ch] === 'miss' ? m.missState : ''
						)}
					onletter={(letter) => onaction({ type: 'letter', letter })}
				/>
				{#if yourTurn}
					<button class="btn ghost" onclick={() => (solving = true)}>{m.solve}</button>
				{/if}
			{/if}
		{:else}
			<p class="result" aria-live="polite">
				{#if view.solvedBy}
					{view.solvedBy.id === youId ? m.you.solved : m.solvedBy(view.solvedBy.name)}
				{:else}
					{m.wordWins}
				{/if}
			</p>
			{#if you}
				<p class="score">
					{#if you.points > 0}<span class="points">{g.points(you.points)}</span>{/if}
					{t.trivia.scoreLine(you.score, you.rank ?? 1, view.leaderboard.length)}
				</p>
			{/if}
			{#if canControl}<button class="btn primary" onclick={next}>{g.next}</button>{/if}
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
	.category {
		padding: 2px 12px;
		border: 2px solid var(--line);
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
		font-weight: 800;
	}
	.board {
		display: grid;
		grid-template-columns: 84px 1fr;
		align-items: center;
		gap: 16px;
	}
	.side {
		display: grid;
		gap: 8px;
	}
	.wrong {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.wrong span {
		padding: 0 8px;
		border: 2px solid var(--danger);
		border-radius: 6px;
		color: var(--danger);
		font-weight: 800;
		text-decoration: line-through;
		text-transform: uppercase;
	}
	.lives {
		font-size: 1.15rem;
		font-weight: 800;
	}
	.banner {
		padding: 10px 14px;
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
		font-weight: 800;
		text-align: center;
	}
	.banner.mine {
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
		font-size: 1.2rem;
	}
	.event {
		font-weight: 750;
		text-align: center;
		animation: pop 300ms ease-out;
	}
	.event.hit {
		color: var(--good);
	}
	.event.miss,
	.event.timeout,
	.event.wrong-solve {
		color: var(--danger);
	}
	.solve {
		display: grid;
		gap: 10px;
	}
	.result {
		font-size: 1.6rem;
		font-weight: 800;
		text-align: center;
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
	@keyframes pop {
		from {
			transform: scale(0.9);
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.event {
			animation: none;
		}
	}
</style>
