<script lang="ts">
	import { MAX_GUESS_LENGTH, type AnagramView } from '@games/anagram';
	import FinalScores from '$lib/components/FinalScores.svelte';
	import SittingOut from '$lib/components/SittingOut.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import WordMask from '$lib/components/WordMask.svelte';
	import type { PlayerViewProps } from '$lib/games/types';
	import { t } from '$lib/i18n';
	import Letters from './Letters.svelte';

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
	const view = $derived(raw as AnagramView);
	const you = $derived(view.you);
	const m = t.anagram;
	const g = t.games;
	const next = () => onaction({ type: 'next' });

	/** Your own reshuffle of the letters; only on this screen. */
	let shuffled = $state<{ round: number; letters: string } | null>(null);
	const letters = $derived(
		shuffled?.round === view.round ? shuffled.letters : (view.letters ?? '')
	);
	function shuffle() {
		const a = [...letters];
		for (let i = a.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[a[i], a[j]] = [a[j]!, a[i]!];
		}
		shuffled = { round: view.round, letters: a.join('') };
	}

	let guessText = $state('');
	function guess(e: SubmitEvent) {
		e.preventDefault();
		const text = guessText.trim();
		if (!text) return;
		onaction({ type: 'guess', text });
		guessText = '';
	}

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
	{:else if (view.phase === 'solve' || view.phase === 'reveal') && view.letters}
		<header class="top">
			<p class="kicker">{m.wordOf(view.round + 1, view.rounds)}</p>
			<p class="category">{view.category ?? m.letters(view.letters.length)}</p>
		</header>
		{#key letters}<Letters {letters} />{/key}
		<WordMask mask={view.mask} />
		<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} />

		{#if view.phase === 'solve' && you}
			{#if you.solved}
				<p class="got card">{m.youGotIt} <span class="points">{g.points(you.points)}</span></p>
			{:else}
				{#key view.round}
					<form class="guess" onsubmit={guess}>
						<label for="anagram-guess" class="sr-only">{m.guessLabel}</label>
						<input
							id="anagram-guess"
							class="input"
							bind:value={guessText}
							use:focus
							maxlength={MAX_GUESS_LENGTH}
							placeholder={m.guessLabel}
							autocomplete="off"
							autocapitalize="off"
							spellcheck="false"
							enterkeyhint="send"
						/>
						<button class="btn primary" disabled={!guessText.trim()}>{m.guess}</button>
					</form>
				{/key}
				<div class="row">
					<p class="wrong" role="status">{you.lastWrong ? m.notIt(you.lastWrong) : ''}</p>
					<button class="btn ghost small" type="button" onclick={shuffle}>🔀 {m.shuffle}</button>
				</div>
			{/if}
		{:else if view.phase === 'reveal'}
			{#if you}
				<p class="score">
					{#if you.points > 0}<span class="points">{g.points(you.points)}</span>{/if}
					{t.trivia.scoreLine(you.score, you.rank ?? 1, view.leaderboard.length)}
				</p>
			{/if}
		{/if}

		{#if canControl}
			{#if view.phase === 'solve'}
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
	.guess {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 10px;
	}
	.row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
	}
	.wrong {
		font-weight: 750;
		color: var(--danger);
		overflow-wrap: anywhere;
	}
	.got {
		padding: 14px;
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
		font-weight: 800;
		text-align: center;
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
</style>
