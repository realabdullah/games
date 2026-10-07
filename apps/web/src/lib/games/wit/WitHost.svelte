<script lang="ts">
	import Motif from '$lib/components/Motif.svelte';
	import type { WitView } from '@games/wit';
	import FinalScores from '$lib/components/FinalScores.svelte';
	import Leaderboard from '$lib/components/Leaderboard.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import type { HostViewProps } from '$lib/games/types';
	import { t } from '$lib/i18n';

	let { view: raw, clockOffset, onaction, onplayagain, onendgame }: HostViewProps = $props();
	const view = $derived(raw as WitView);
	const m = t.wit;
	const g = t.games;
	const next = () => onaction({ type: 'next' });
</script>

<section class="host">
	{#if view.phase === 'intro'}
		<div class="center">
			<p class="kicker">{g.roundOf(1, view.rounds)}</p>
			<h2 class="title">Quick Wit</h2>
			<p class="big">{m.howTo}</p>
			<div class="timer">
				<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} large />
			</div>
			<button class="btn" onclick={next}>{g.startNow}</button>
		</div>
	{:else if view.phase === 'write'}
		<div class="center">
			<p class="kicker">{g.roundOf(view.round + 1, view.rounds)}</p>
			<h2 class="title">✍️ {m.writeOnPhone}</h2>
			<p class="big" aria-live="polite">{g.done(view.doneCount, view.expectedCount)}</p>
			<div class="timer">
				<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} large />
			</div>
			<button class="btn ghost small" onclick={next}>{g.skip}</button>
		</div>
	{:else if (view.phase === 'vote' || view.phase === 'result') && view.current}
		{@const c = view.current}
		<header class="top">
			<p class="kicker">{m.matchupOf(c.number, c.total)}</p>
			{#if view.phase === 'vote'}
				<p class="count" aria-live="polite">{g.done(view.doneCount, view.expectedCount)}</p>
			{/if}
		</header>
		<h2 class="prompt">{c.prompt}</h2>
		<div class="versus">
			{#each ['a', 'b'] as const as side (side)}
				{@const res = view.result?.[side]}
				<div class="card side side-{side}" class:winner={view.result?.sweep === side}>
					<p class="text">{c[side] ?? m.noAnswer}</p>
					{#if res}
						<div class="by">
							<span class="avatar" aria-hidden="true"><Motif id={res.player.avatar} /></span>
							<strong>{res.player.name}</strong>
							<span class="votes">{m.votes(res.votes)}</span>
							{#if res.points > 0}<span class="pts">{g.points(res.points)}</span>{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
		{#if view.phase === 'vote'}
			<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} large />
			<footer><button class="btn ghost small" onclick={next}>{g.skip}</button></footer>
		{:else}
			{#if view.result?.sweep}<p class="sweep">{m.sweep}</p>{/if}
			<div class="board"><Leaderboard entries={view.leaderboard} limit={5} large /></div>
			<footer><button class="btn primary" onclick={next}>{g.next}</button></footer>
		{/if}
	{:else if view.phase === 'final'}
		<FinalScores leaderboard={view.leaderboard} canControl large {onplayagain} {onendgame} />
	{/if}
</section>

<style>
	.host {
		display: grid;
		gap: clamp(16px, 2.5vw, 28px);
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
		font-weight: 700;
		color: var(--gold);
		text-transform: uppercase;
		letter-spacing: 0.16em;
		font-size: clamp(1rem, 1.6vw, 1.3rem);
	}
	.title {
		font-size: clamp(2.6rem, 7vw, 5rem);
	}
	.big {
		font-size: clamp(1.4rem, 2.6vw, 2.2rem);
		font-family: var(--display);
		font-weight: 400;
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.count {
		font-size: clamp(1.1rem, 2vw, 1.6rem);
		font-weight: 750;
	}
	.prompt {
		font-size: clamp(2rem, 4.5vw, 3.4rem);
	}
	.versus {
		display: grid;
		gap: 24px;
	}
	@media (min-width: 800px) {
		.versus {
			grid-template-columns: 1fr 1fr;
		}
	}
	.side {
		display: grid;
		align-content: space-between;
		gap: 18px;
		min-height: 180px;
		padding: clamp(20px, 3vw, 36px);
		box-shadow: var(--shadow-lg);
	}
	.side-a {
		background: var(--clay);
		--ink: var(--indigo);
		--ink-soft: var(--faded);
		--line: var(--indigo);
		--border: 1.5px solid var(--indigo);
		--stitch: 1.5px dashed var(--indigo);
		--good: #1d6a43;
		--danger: var(--madder);
		--warn: #855700;
		color: var(--ink);
	}
	.side-b {
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
	}
	.winner {
		animation: pop 450ms cubic-bezier(0.3, 1.5, 0.5, 1);
	}
	.text {
		font-size: clamp(1.8rem, 3.6vw, 3rem);
		font-weight: 800;
		line-height: 1.15;
		overflow-wrap: anywhere;
	}
	.by {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		font-size: clamp(1.1rem, 2vw, 1.5rem);
	}
	.avatar {
		font-size: 2em;
		line-height: 1;
	}
	.votes {
		margin-left: auto;
		font-weight: 800;
	}
	.pts {
		padding: 2px 12px;
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
	}
	.sweep {
		justify-self: center;
		padding: 8px 22px;
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
		box-shadow: var(--shadow);
		font-size: clamp(1.3rem, 2.4vw, 2rem);
		font-weight: 800;
	}
	.board {
		width: min(100%, 760px);
		margin: 0 auto;
	}
	footer {
		display: flex;
		justify-content: center;
	}
	@keyframes pop {
		50% {
			transform: scale(1.04);
		}
	}
</style>
