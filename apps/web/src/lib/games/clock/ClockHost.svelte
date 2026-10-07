<script lang="ts">
	import type { ClockView } from '@games/clock';
	import FinalScores from '$lib/components/FinalScores.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import type { HostViewProps } from '$lib/games/types';
	import { t } from '$lib/i18n';
	import ClockHistory from './ClockHistory.svelte';
	import ClockResults from './ClockResults.svelte';
	import { seconds } from './format';

	let { view: raw, clockOffset, onaction, onplayagain, onendgame }: HostViewProps = $props();
	const view = $derived(raw as ClockView);
	const m = t.clock;
	const g = t.games;
	const next = () => onaction({ type: 'next' });
</script>

<section class="host">
	{#if view.phase === 'intro'}
		<div class="center">
			<h2 class="title">Stop the Clock</h2>
			<p class="big">{m.howTo}</p>
			<div class="timer">
				<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} large />
			</div>
			<button class="btn" onclick={next}>{g.startNow}</button>
		</div>
	{:else if view.phase !== 'final' && view.target !== null}
		<header class="top">
			<p class="kicker">{m.roundOf(view.round + 1, view.rounds)}</p>
			{#if view.phase === 'run'}
				<p class="count">{m.tappedCount(view.tappedCount, view.playerCount)}</p>
			{/if}
		</header>
		<div class="center">
			<p class="target">{m.target(seconds(view.target, 1))}</p>
			{#if view.phase === 'ready'}
				<p class="big">{m.getSet}</p>
				<div class="timer">
					<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} large />
				</div>
			{:else if view.phase === 'run'}
				<!-- Nothing here moves: anything with a steady beat would give the time away. -->
				<p class="big" role="status">{m.running}</p>
				<p class="hourglass" aria-hidden="true">⏳</p>
			{:else}
				<div class="results">
					<ClockResults results={view.results} target={view.target} large />
				</div>
				{#if view.history.length > 1}
					<div class="results">
						<ClockHistory history={view.history} players={view.leaderboard} large />
					</div>
				{/if}
			{/if}
		</div>
		<footer>
			{#if view.phase === 'reveal'}
				<button class="btn primary" onclick={next}>{g.next}</button>
			{/if}
		</footer>
	{:else if view.phase === 'final'}
		<FinalScores leaderboard={view.leaderboard} canControl large {onplayagain} {onendgame} />
		<div class="final-history">
			<ClockHistory history={view.history} players={view.leaderboard} large />
		</div>
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
	.timer,
	.results {
		width: min(100%, 640px);
	}
	.title {
		font-size: clamp(2.6rem, 7vw, 5rem);
	}
	.big {
		max-width: 30ch;
		font-size: clamp(1.4rem, 2.6vw, 2.2rem);
		font-family: var(--display);
		font-weight: 400;
	}
	.target {
		font-size: clamp(3rem, 9vw, 7rem);
		font-weight: 800;
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
	}
	.hourglass {
		font-size: clamp(4rem, 10vw, 8rem);
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 16px;
	}
	.kicker {
		font-weight: 700;
		color: var(--gold);
		text-transform: uppercase;
		letter-spacing: 0.16em;
		font-size: clamp(1rem, 1.6vw, 1.3rem);
	}
	.count {
		font-size: clamp(1.1rem, 2vw, 1.6rem);
		font-weight: 750;
	}
	.final-history {
		justify-self: center;
		width: min(100%, 900px);
	}
	footer {
		display: flex;
		justify-content: center;
	}
</style>
