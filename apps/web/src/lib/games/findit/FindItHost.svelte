<script lang="ts">
	import type { FindItView } from '@games/findit';
	import FinalScores from '$lib/components/FinalScores.svelte';
	import Finishers from '$lib/components/Finishers.svelte';
	import Leaderboard from '$lib/components/Leaderboard.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import type { HostViewProps } from '$lib/games/types';
	import { t } from '$lib/i18n';
	import FindGrid from './FindGrid.svelte';

	let { view: raw, clockOffset, onaction, onplayagain, onendgame }: HostViewProps = $props();
	const view = $derived(raw as FindItView);
	const m = t.findit;
	const g = t.games;
	const next = () => onaction({ type: 'next' });
</script>

<section class="host">
	{#if view.phase === 'intro'}
		<div class="center">
			<h2 class="title">Find It</h2>
			<p class="big">{m.howTo}</p>
			<div class="timer">
				<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} large />
			</div>
			<button class="btn" onclick={next}>{g.startNow}</button>
		</div>
	{:else if view.phase === 'find' || view.phase === 'reveal'}
		<header class="top">
			<p class="kicker">{m.gridOf(view.round + 1, view.rounds)}</p>
			<p class="prompt">{view.find === null ? m.findOdd : m.find(view.find)}</p>
		</header>
		<div class="stage">
			<div class="main">
				{#key view.round}
					<FindGrid cells={view.cells} size={view.size} answer={view.answer} large />
				{/key}
				{#if view.phase === 'find'}
					<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} large />
				{/if}
			</div>
			<aside class="side">
				{#if view.phase === 'find'}
					<p class="count">{m.found(view.foundCount, view.playerCount)}</p>
					<Finishers players={view.finders} empty={m.noneYet} first={m.first} />
				{:else}
					<Leaderboard entries={view.leaderboard} limit={5} />
				{/if}
			</aside>
		</div>
		<footer>
			{#if view.phase === 'find'}
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
		align-items: center;
		gap: 16px;
	}
	.kicker {
		font-weight: 750;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: clamp(1rem, 1.6vw, 1.3rem);
	}
	.prompt {
		padding: 4px 18px;
		border: var(--border);
		border-radius: 999px;
		background: var(--yellow);
		font-size: clamp(1.4rem, 3vw, 2.4rem);
		font-weight: 800;
	}
	.stage {
		display: grid;
		gap: 24px;
	}
	@media (min-width: 960px) {
		.stage {
			grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
		}
	}
	.main {
		display: grid;
		gap: 16px;
		align-content: center;
	}
	.side {
		display: grid;
		gap: 12px;
		align-content: start;
	}
	.count {
		font-size: clamp(1.1rem, 2vw, 1.6rem);
		font-weight: 750;
	}
	footer {
		display: flex;
		justify-content: center;
	}
</style>
