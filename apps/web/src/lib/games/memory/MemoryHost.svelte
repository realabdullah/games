<script lang="ts">
	import Motif from '$lib/components/Motif.svelte';
	import type { MemoryView } from '@games/memory';
	import FinalScores from '$lib/components/FinalScores.svelte';
	import Leaderboard from '$lib/components/Leaderboard.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import type { HostViewProps } from '$lib/games/types';
	import { t } from '$lib/i18n';
	import MemoryGrid from './MemoryGrid.svelte';

	let { view: raw, clockOffset, onaction, onplayagain, onendgame }: HostViewProps = $props();
	const view = $derived(raw as MemoryView);
	const m = t.memory;
	const g = t.games;
	const next = () => onaction({ type: 'next' });
</script>

<section class="host">
	{#if view.phase === 'intro'}
		<div class="center">
			<h2 class="title">Memory Grid</h2>
			<p class="big">{m.howTo}</p>
			<div class="timer">
				<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} large />
			</div>
			<button class="btn" onclick={next}>{g.startNow}</button>
		</div>
	{:else if view.phase !== 'final'}
		<header class="top">
			<p class="kicker">{m.roundOf(view.round + 1, view.rounds)}</p>
			<p class="prompt">
				{view.phase === 'show' ? m.watch : m.tapThem(view.count)}
			</p>
		</header>
		<div class="stage">
			<div class="main">
				{#key view.round}<MemoryGrid size={view.size} lit={view.tiles} large />{/key}
				{#if view.phase !== 'reveal'}
					<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} large />
				{/if}
			</div>
			<aside class="side">
				{#if view.phase === 'reveal'}
					<ol class="results">
						{#each view.results as r (r.player.id)}
							<li>
								<span aria-hidden="true"><Motif id={r.player.avatar} /></span>
								<strong>{r.player.name}</strong>
								<span class="got">{r.perfect ? m.perfect : m.got(r.right, view.count)}</span>
							</li>
						{/each}
					</ol>
					<Leaderboard entries={view.leaderboard} limit={5} />
				{:else if view.phase === 'recall'}
					<p class="count">{m.done(view.doneCount, view.playerCount)}</p>
				{/if}
			</aside>
		</div>
		<footer>
			{#if view.phase === 'recall'}
				<button class="btn ghost small" onclick={next}>{g.skip}</button>
			{:else if view.phase === 'reveal'}
				<button class="btn primary" onclick={next}>{g.next}</button>
			{/if}
		</footer>
	{:else}
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
		font-family: var(--display);
		font-weight: 400;
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
	}
	.kicker {
		font-weight: 700;
		color: var(--gold);
		text-transform: uppercase;
		letter-spacing: 0.16em;
		font-size: clamp(1rem, 1.6vw, 1.3rem);
	}
	.prompt {
		padding: 4px 18px;
		border: var(--border);
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
		font-size: clamp(1.2rem, 2.4vw, 2rem);
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
	.results {
		display: grid;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: clamp(1rem, 1.6vw, 1.3rem);
	}
	.results li {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.results .got {
		margin-left: auto;
		font-weight: 750;
	}
	footer {
		display: flex;
		justify-content: center;
	}
</style>
