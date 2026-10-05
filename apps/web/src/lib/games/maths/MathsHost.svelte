<script lang="ts">
	import type { MathsView } from '@games/maths';
	import FinalScores from '$lib/components/FinalScores.svelte';
	import Leaderboard from '$lib/components/Leaderboard.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import type { HostViewProps } from '$lib/games/types';
	import { t } from '$lib/i18n';

	let { view: raw, clockOffset, onaction, onplayagain, onendgame }: HostViewProps = $props();
	const view = $derived(raw as MathsView);
	const m = t.maths;
	const g = t.games;
	const next = () => onaction({ type: 'next' });
</script>

<section class="host">
	{#if view.phase === 'intro'}
		<div class="center">
			<h2 class="title">Quick Maths</h2>
			<p class="big">{m.howTo}</p>
			<p class="example" aria-hidden="true">7 × 8 = 56</p>
			<div class="timer">
				<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} large />
			</div>
			<button class="btn" onclick={next}>{g.startNow}</button>
		</div>
	{:else if (view.phase === 'sum' || view.phase === 'reveal') && view.sum}
		<header class="top">
			<p class="kicker">{m.sumOf(view.round + 1, view.rounds)}</p>
			{#if view.phase === 'sum'}
				<p class="count">{m.solved(view.solvedCount, view.playerCount)}</p>
			{/if}
		</header>
		<div class="stage">
			<div class="main">
				{#key view.round}
					<p class="sum">
						{view.sum}
						<span class="equals">=</span>
						<span class="answer" class:shown={view.answer !== null}
							>{view.answer?.toLocaleString('en') ?? '?'}</span
						>
					</p>
				{/key}
				{#if view.phase === 'sum'}
					<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} large />
				{/if}
			</div>
			<aside class="side">
				{#if view.phase === 'sum'}
					<ol class="solvers card" aria-live="polite">
						{#each view.solvers as p, i (p.id)}
							<li>
								<span aria-hidden="true">{p.avatar}</span>
								<strong>{p.name}</strong>
								{#if i === 0}<span class="first">{m.first}</span>{/if}
							</li>
						{:else}
							<li class="empty">{m.noneYet}</li>
						{/each}
					</ol>
				{:else}
					<Leaderboard entries={view.leaderboard} limit={5} />
				{/if}
			</aside>
		</div>
		<footer>
			{#if view.phase === 'sum'}
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
	.example {
		font-size: clamp(1.3rem, 2.4vw, 2rem);
		font-weight: 750;
		color: var(--ink-soft);
		font-variant-numeric: tabular-nums;
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
	.count {
		font-size: clamp(1.1rem, 2vw, 1.6rem);
		font-weight: 750;
	}
	.stage {
		display: grid;
		gap: 24px;
	}
	@media (min-width: 960px) {
		.stage {
			grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
			min-height: calc(100dvh - 300px);
		}
	}
	.main {
		display: grid;
		gap: clamp(16px, 3vh, 32px);
		align-content: center;
		justify-items: center;
		text-align: center;
	}
	.sum {
		font-size: clamp(3.4rem, 10vw, 8rem);
		font-weight: 800;
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
		animation: pop 450ms cubic-bezier(0.3, 1.5, 0.5, 1);
	}
	.equals {
		color: var(--ink-soft);
	}
	.answer {
		color: var(--ink-soft);
	}
	.answer.shown {
		color: oklch(45% 0.13 160);
	}
	.side {
		display: grid;
		align-content: start;
	}
	.solvers {
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 14px 16px;
		list-style: none;
		font-size: clamp(1rem, 1.6vw, 1.3rem);
	}
	.solvers li {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.empty {
		color: var(--ink-soft);
	}
	.first {
		margin-left: auto;
		padding: 2px 10px;
		border-radius: 999px;
		background: var(--yellow);
		font-weight: 800;
		font-size: 0.85em;
	}
	footer {
		display: flex;
		justify-content: center;
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
