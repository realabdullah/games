<script lang="ts">
	import type { XoView } from '@games/xo';
	import FinalScores from '$lib/components/FinalScores.svelte';
	import Leaderboard from '$lib/components/Leaderboard.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import type { HostViewProps } from '$lib/games/types';
	import { t } from '$lib/i18n';
	import XoBoard from './XoBoard.svelte';
	import XoVersus from './XoVersus.svelte';

	let { view: raw, clockOffset, onaction, onplayagain, onendgame }: HostViewProps = $props();
	const view = $derived(raw as XoView);
	const m = t.xo;
	const g = t.games;
	const next = () => onaction({ type: 'next' });
</script>

<section class="host">
	{#if view.phase === 'intro'}
		<div class="center">
			<h2 class="title">X-O Battle</h2>
			<p class="big">{m.howTo}</p>
			<div class="timer">
				<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} large />
			</div>
			<button class="btn" onclick={next}>{g.startNow}</button>
		</div>
	{:else if view.phase === 'turn' || view.phase === 'result'}
		<header class="top">
			<p class="kicker">{m.matchOf(view.match + 1, view.matches)}</p>
			{#if view.upNext}<p class="next">{m.upNext(view.upNext.name)}</p>{/if}
		</header>
		<div class="stage">
			<div class="play">
				<XoVersus {view} large />
				{#if view.phase === 'turn'}
					<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} large />
				{:else}
					<p class="outcome">{view.winner ? m.wins(view.winner.name) : m.draw}</p>
				{/if}
				<XoBoard board={view.board} winLine={view.winLine} large />
			</div>
			<aside>
				<Leaderboard entries={view.leaderboard} limit={6} />
				{#if view.phase === 'result'}
					<button class="btn pink" onclick={next}>{g.next}</button>
				{/if}
			</aside>
		</div>
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
		max-width: 30ch;
		font-size: clamp(1.4rem, 2.6vw, 2.2rem);
		font-weight: 750;
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.next {
		font-size: clamp(1.1rem, 2vw, 1.6rem);
		font-weight: 750;
	}
	.stage {
		display: grid;
		gap: 24px;
	}
	@media (min-width: 960px) {
		.stage {
			grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr);
			align-items: start;
		}
	}
	.play {
		display: grid;
		gap: 18px;
	}
	.outcome {
		font-size: clamp(1.6rem, 3vw, 2.4rem);
		line-height: 1.2;
		font-weight: 800;
		text-align: center;
		animation: pop 400ms cubic-bezier(0.3, 1.5, 0.5, 1);
	}
	aside {
		display: grid;
		gap: 18px;
	}
	aside .btn {
		justify-self: center;
	}
	@keyframes pop {
		from {
			transform: scale(0.8);
			opacity: 0;
		}
	}
</style>
