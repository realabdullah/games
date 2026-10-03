<script lang="ts">
	import { MAX_GUESS_LENGTH, type DoodleView } from '@games/doodle';
	import FinalScores from '$lib/components/FinalScores.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import type { PlayerViewProps } from '$lib/games/types';
	import SittingOut from '$lib/components/SittingOut.svelte';
	import { t } from '$lib/i18n';
	import DoodleCanvas from './DoodleCanvas.svelte';
	import GuessFeed from '$lib/components/GuessFeed.svelte';

	let {
		view: raw,
		clockOffset,
		youId,
		audience,
		canControl,
		onaction,
		onplayagain,
		onendgame,
		stream
	}: PlayerViewProps = $props();
	const view = $derived(raw as DoodleView);
	const you = $derived(view.you);
	const m = t.doodle;
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
	{#if !you && !audience && view.phase !== 'final'}<SittingOut />{/if}
	{#if view.phase === 'intro'}
		<div class="center">
			<h2 class="huge">{g.getReady}</h2>
			<p>{m.howTo}</p>
			<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} />
			{#if canControl}<button class="btn" onclick={next}>{g.startNow}</button>{/if}
		</div>
	{:else if view.phase === 'choose' && view.drawer}
		<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} />
		{#if view.choices}
			<h2 class="title">{m.pickWord}</h2>
			<div class="choices">
				{#each view.choices as word, i (word)}
					<button class="btn" onclick={() => onaction({ type: 'choose', index: i })}>{word}</button>
				{/each}
			</div>
		{:else}
			<div class="center">
				<p class="avatar" aria-hidden="true">{view.drawer.avatar}</p>
				<h2 class="title">{m.choosing(view.drawer.name)}</h2>
			</div>
		{/if}
	{:else if (view.phase === 'draw' || view.phase === 'reveal') && view.drawer}
		{#if you?.isDrawer && view.phase === 'draw'}
			<p class="word-bar">{m.draw} <strong>{view.word}</strong></p>
		{:else if view.phase === 'draw'}
			<p class="kicker">{m.drawing(view.drawer.name)}</p>
			<p class="mask">
				{#each view.mask as ch, i (i)}<span class:gap={ch === ' '}>{ch === ' ' ? '' : ch}</span
					>{/each}
			</p>
		{:else}
			<p class="word-bar">{m.theWordWas} <strong>{view.word}</strong></p>
		{/if}

		<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} />
		<DoodleCanvas
			turn={view.turn}
			{stream}
			canDraw={!!you?.isDrawer && view.phase === 'draw'}
			{youId}
		/>

		{#if view.phase === 'draw' && !you?.isDrawer}
			{#if you?.guessed}
				<p class="got card">{m.youGotIt}</p>
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
		{/if}
		{#if view.phase === 'draw'}<GuessFeed feed={view.feed} />{/if}
		{#if view.phase === 'reveal' && you && you.points > 0}
			<p class="points">{g.points(you.points)}</p>
		{/if}

		{#if canControl}
			{#if view.phase === 'draw'}
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
	.title {
		font-size: clamp(1.6rem, 6vw, 2.2rem);
	}
	.avatar {
		font-size: 4rem;
		line-height: 1;
	}
	.choices {
		display: grid;
		gap: 12px;
	}
	.choices .btn {
		min-height: 64px;
		font-size: 1.4rem;
		text-transform: capitalize;
	}
	.word-bar {
		padding: 12px 16px;
		border: var(--border);
		border-radius: var(--radius-sm);
		background: var(--yellow);
		font-size: 1.3rem;
	}
	.word-bar strong {
		text-transform: capitalize;
	}
	.mask {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		font-size: 1.8rem;
		font-weight: 800;
		text-transform: uppercase;
	}
	.mask span {
		min-width: 0.9em;
		border-bottom: 3px solid var(--ink);
		text-align: center;
		line-height: 1.1;
	}
	.mask .gap {
		border: 0;
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
	.points {
		font-size: 2rem;
		font-weight: 800;
		text-align: center;
	}
</style>
