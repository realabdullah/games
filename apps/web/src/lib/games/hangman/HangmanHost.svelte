<script lang="ts">
	import type { HangmanView } from '@games/hangman';
	import FinalScores from '$lib/components/FinalScores.svelte';
	import Leaderboard from '$lib/components/Leaderboard.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import WordMask from '$lib/components/WordMask.svelte';
	import type { HostViewProps } from '$lib/games/types';
	import { t } from '$lib/i18n';
	import { eventText } from './event';
	import Gallows from './Gallows.svelte';

	let { view: raw, clockOffset, onaction, onplayagain, onendgame }: HostViewProps = $props();
	const view = $derived(raw as HangmanView);
	const m = t.hangman;
	const g = t.games;
	const next = () => onaction({ type: 'next' });
</script>

<section class="host">
	{#if view.phase === 'intro'}
		<div class="center">
			<h2 class="title">Hangman</h2>
			<p class="big">{m.howTo}</p>
			<div class="timer">
				<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} large />
			</div>
			<button class="btn" onclick={next}>{g.startNow}</button>
		</div>
	{:else if view.phase === 'turn' || view.phase === 'reveal'}
		<header class="top">
			<p class="kicker">{m.wordOf(view.round + 1, view.rounds)}</p>
			<p class="category">{view.category}</p>
		</header>

		<div class="stage">
			<div class="drawing card">
				<Gallows misses={view.misses} max={view.maxMisses} />
				<p class="lives">{m.lives(view.maxMisses - view.misses)}</p>
			</div>
			<div class="main">
				<WordMask mask={view.mask} large />
				{#if view.wrong.length}
					<p class="wrong" aria-label="Wrong letters: {view.wrong.join(', ')}">
						{#each view.wrong as ch (ch)}<span>{ch}</span>{/each}
					</p>
				{/if}

				{#if view.phase === 'turn' && view.turn}
					<div class="turn card">
						<span class="avatar" aria-hidden="true">{view.turn.avatar}</span>
						<span class="who">{m.turn(view.turn.name)}</span>
					</div>
					<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} large />
					{#if view.upNext && view.upNext.id !== view.turn.id}
						<p class="muted">{m.upNext(view.upNext.name)}</p>
					{/if}
				{:else}
					<p class="result">
						{view.solvedBy ? m.solvedBy(view.solvedBy.name) : m.wordWins}
					</p>
				{/if}

				{#if view.event && view.phase === 'turn'}
					{#key view.event.n}
						<p class="event {view.event.kind}" aria-live="polite">{eventText(view.event)}</p>
					{/key}
				{/if}
			</div>
			{#if view.phase === 'reveal'}
				<aside><Leaderboard entries={view.leaderboard} limit={5} /></aside>
			{/if}
		</div>

		<footer>
			{#if view.phase === 'reveal'}
				<button class="btn pink" onclick={next}>{g.next}</button>
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
		font-weight: 750;
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 16px;
	}
	.kicker {
		font-weight: 750;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: clamp(1rem, 1.6vw, 1.3rem);
	}
	.category {
		padding: 4px 16px;
		border: var(--border);
		border-radius: 999px;
		background: var(--yellow);
		font-size: clamp(1.1rem, 2vw, 1.6rem);
		font-weight: 800;
	}
	.stage {
		display: grid;
		gap: 24px;
		align-items: start;
	}
	@media (min-width: 960px) {
		.stage {
			grid-template-columns: minmax(200px, 1fr) minmax(0, 2.4fr);
		}
		.stage:has(aside) {
			grid-template-columns: minmax(200px, 1fr) minmax(0, 2fr) minmax(260px, 1.2fr);
		}
	}
	.drawing {
		display: grid;
		gap: 8px;
		justify-items: center;
		padding: 20px;
		max-width: 320px;
		width: 100%;
		margin: 0 auto;
	}
	.lives {
		font-weight: 800;
		font-size: clamp(1rem, 1.6vw, 1.3rem);
	}
	.main {
		display: grid;
		gap: 20px;
		justify-items: center;
		text-align: center;
	}
	.wrong {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 8px;
	}
	.wrong span {
		padding: 2px 12px;
		border: 2px solid var(--danger);
		border-radius: 8px;
		color: var(--danger);
		font-size: clamp(1.1rem, 2vw, 1.6rem);
		font-weight: 800;
		text-decoration: line-through;
		text-transform: uppercase;
	}
	.turn {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 12px 24px;
		background: var(--teal);
	}
	.avatar {
		font-size: clamp(2rem, 4vw, 3rem);
		line-height: 1;
	}
	.who {
		font-size: clamp(1.4rem, 3vw, 2.4rem);
		font-weight: 800;
	}
	.result {
		font-size: clamp(1.8rem, 4vw, 3rem);
		font-weight: 800;
		animation: pop 450ms cubic-bezier(0.3, 1.5, 0.5, 1);
	}
	.event {
		font-size: clamp(1.1rem, 2vw, 1.6rem);
		font-weight: 750;
		animation: pop 350ms cubic-bezier(0.3, 1.5, 0.5, 1);
	}
	.event.hit {
		color: oklch(45% 0.13 160);
	}
	.event.miss,
	.event.timeout,
	.event.wrong-solve {
		color: var(--danger);
	}
	footer {
		display: flex;
		justify-content: center;
	}
	@keyframes pop {
		from {
			transform: scale(0.85);
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.result,
		.event {
			animation: none;
		}
	}
</style>
