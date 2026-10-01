<script lang="ts">
	import type { DoodleView } from '@games/doodle';
	import FinalScores from '$lib/components/FinalScores.svelte';
	import Leaderboard from '$lib/components/Leaderboard.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import type { HostViewProps } from '$lib/games/types';
	import { t } from '$lib/i18n';
	import DoodleCanvas from './DoodleCanvas.svelte';
	import GuessFeed from './GuessFeed.svelte';

	let {
		view: raw,
		clockOffset,
		onaction,
		onplayagain,
		onendgame,
		stream
	}: HostViewProps = $props();
	const view = $derived(raw as DoodleView);
	const m = t.doodle;
	const g = t.games;
	const next = () => onaction({ type: 'next' });
</script>

<section class="host">
	{#if view.phase === 'intro'}
		<div class="center">
			<h2 class="title">Doodle Dash</h2>
			<p class="big">{m.howTo}</p>
			<div class="timer">
				<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} large />
			</div>
			<button class="btn" onclick={next}>{g.startNow}</button>
		</div>
	{:else if view.phase === 'choose' && view.drawer}
		<div class="center">
			<p class="kicker">{m.turnOf(view.turn + 1, view.turns)}</p>
			<p class="avatar" aria-hidden="true">{view.drawer.avatar}</p>
			<h2 class="title">{m.choosing(view.drawer.name)}</h2>
		</div>
	{:else if (view.phase === 'draw' || view.phase === 'reveal') && view.drawer}
		<header class="top">
			<p class="kicker">{m.drawing(view.drawer.name)} · {m.turnOf(view.turn + 1, view.turns)}</p>
			{#if view.phase === 'draw'}
				<p class="count">{m.guessed(view.guessedCount, view.guesserCount)}</p>
			{/if}
		</header>
		<div class="stage">
			<div class="board">
				<DoodleCanvas turn={view.turn} {stream} canDraw={false} youId={null} />
			</div>
			<aside class="side" class:drawing={view.phase === 'draw'}>
				{#if view.phase === 'draw'}
					<p class="mask" aria-label="{view.mask.filter((c) => c !== ' ').length} letters">
						{#each view.mask as ch, i (i)}<span class:gap={ch === ' '}>{ch === ' ' ? '' : ch}</span
							>{/each}
					</p>
					<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} large />
					<GuessFeed feed={view.feed} large />
				{:else}
					<p class="muted">{m.theWordWas}</p>
					<p class="word">{view.word}</p>
					<Leaderboard entries={view.leaderboard} limit={5} />
				{/if}
			</aside>
		</div>
		<footer>
			{#if view.phase === 'draw'}
				<button class="btn ghost small" onclick={next}>{g.skip}</button>
			{:else}
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
	.kicker {
		font-weight: 750;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: clamp(1rem, 1.6vw, 1.3rem);
	}
	.title {
		font-size: clamp(2.6rem, 7vw, 5rem);
	}
	.big {
		font-size: clamp(1.4rem, 2.6vw, 2.2rem);
		font-weight: 750;
	}
	.avatar {
		font-size: clamp(4rem, 10vw, 8rem);
		line-height: 1;
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 16px;
	}
	.count {
		font-size: clamp(1.1rem, 2vw, 1.6rem);
		font-weight: 750;
	}
	.stage {
		display: grid;
		gap: 20px;
	}
	@media (min-width: 960px) {
		.stage {
			grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
		}
		/* Keep the 4:3 canvas inside the screen height, so nothing scrolls on a TV. */
		.board {
			width: min(100%, calc((100dvh - 290px) * 4 / 3));
		}
	}
	.side {
		display: grid;
		align-content: start;
		gap: 16px;
	}
	/* While drawing, the guess feed fills the rest of the column. */
	.side.drawing {
		grid-template-rows: auto auto minmax(160px, 1fr);
		align-content: stretch;
	}
	.mask {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		font-size: clamp(1.4rem, 2.2vw, 2.2rem);
		font-weight: 800;
		text-transform: uppercase;
	}
	.mask span {
		min-width: 0.9em;
		border-bottom: 4px solid var(--ink);
		text-align: center;
		line-height: 1.1;
	}
	.mask .gap {
		border: 0;
	}
	.word {
		font-size: clamp(2.4rem, 5vw, 4rem);
		font-weight: 800;
		text-transform: capitalize;
		animation: pop 450ms cubic-bezier(0.3, 1.5, 0.5, 1);
	}
	footer {
		display: flex;
		justify-content: center;
	}
	@keyframes pop {
		from {
			transform: scale(0.8);
			opacity: 0;
		}
	}
</style>
