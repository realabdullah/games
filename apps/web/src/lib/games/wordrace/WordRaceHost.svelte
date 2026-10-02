<script lang="ts">
	import type { WordRaceView } from '@games/wordrace';
	import FinalScores from '$lib/components/FinalScores.svelte';
	import Leaderboard from '$lib/components/Leaderboard.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import type { HostViewProps } from '$lib/games/types';
	import { t } from '$lib/i18n';
	import Board from './Board.svelte';

	let { view: raw, clockOffset, onaction, onplayagain, onendgame }: HostViewProps = $props();
	const view = $derived(raw as WordRaceView);
	const m = t.wordrace;
	const g = t.games;
	const next = () => onaction({ type: 'next' });
</script>

<section class="host">
	{#if view.phase === 'intro'}
		<div class="center">
			<h2 class="title">Word Race</h2>
			<p class="big">{m.howTo}</p>
			<p class="legend">
				<span class="swatch hit" aria-hidden="true"></span>
				<span class="swatch near" aria-hidden="true"></span>
				{m.legend}
			</p>
			<div class="timer">
				<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} large />
			</div>
			<button class="btn" onclick={next}>{g.startNow}</button>
		</div>
	{:else if view.phase === 'guess' || view.phase === 'reveal'}
		<header class="top">
			<p class="kicker">{m.wordOf(view.round + 1, view.rounds)}</p>
			{#if view.phase === 'guess'}
				<p class="count">{m.done(view.doneCount, view.playerCount)}</p>
			{/if}
		</header>
		<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} large />

		{#if view.phase === 'reveal' && view.answer}
			<div class="reveal">
				<p class="muted">{m.theWordWas}</p>
				<p class="answer" aria-label={view.answer}>
					{#each view.answer as ch, i (i)}<span style:--i={i}>{ch}</span>{/each}
				</p>
			</div>
		{:else}
			<p class="hint">{m.guessOnPhone}</p>
		{/if}

		<div class="stage" class:revealed={view.phase === 'reveal'}>
			<ul class="boards">
				{#each view.boards as b (b.player.id)}
					<li class="player card" class:solved={b.solved} class:out={b.out}>
						<p class="name">
							<span aria-hidden="true">{b.player.avatar}</span>
							<span class="who">{b.player.name}</span>
							{#if b.solved}<span class="pts">{g.points(b.points)}</span>{/if}
						</p>
						<Board
							rows={b.marks.map((marks) => ({ marks }))}
							size="sm"
							label={m.board(b.player.name)}
						/>
					</li>
				{/each}
			</ul>
			{#if view.phase === 'reveal'}
				<aside><Leaderboard entries={view.leaderboard} limit={5} /></aside>
			{/if}
		</div>

		<footer>
			{#if view.phase === 'guess'}
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
		gap: clamp(14px, 2vw, 22px);
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
	.legend {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: clamp(1rem, 1.6vw, 1.3rem);
	}
	.swatch {
		width: 1.2em;
		height: 1.2em;
		border: 2px solid var(--line);
		border-radius: 4px;
	}
	.swatch.hit {
		background: oklch(72% 0.17 150);
	}
	.swatch.near {
		background: var(--yellow);
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
	.hint {
		font-size: clamp(1.2rem, 2vw, 1.6rem);
		font-weight: 750;
		text-align: center;
	}
	.reveal {
		display: grid;
		justify-items: center;
		gap: 6px;
	}
	.answer {
		display: flex;
		gap: 8px;
	}
	.answer span {
		display: grid;
		place-items: center;
		width: clamp(52px, 6vw, 84px);
		aspect-ratio: 1;
		border: var(--border);
		border-radius: 10px;
		background: oklch(72% 0.17 150);
		font-size: clamp(2rem, 4vw, 3.4rem);
		font-weight: 800;
		text-transform: uppercase;
		animation: flip 450ms ease-out backwards;
		animation-delay: calc(var(--i) * 110ms);
	}
	.stage {
		display: grid;
		gap: 20px;
	}
	@media (min-width: 960px) {
		.stage.revealed {
			grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
			align-items: start;
		}
	}
	.boards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 210px));
		justify-content: center;
		gap: 16px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.player {
		display: grid;
		gap: 8px;
		padding: 10px;
		box-shadow: 3px 3px 0 var(--line);
	}
	.player.solved {
		background: oklch(93% 0.07 150);
	}
	.player.out {
		opacity: 0.6;
	}
	.name {
		display: flex;
		align-items: center;
		gap: 6px;
		font-weight: 750;
	}
	.who {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.pts {
		color: oklch(45% 0.13 160);
		font-variant-numeric: tabular-nums;
	}
	footer {
		display: flex;
		justify-content: center;
	}
	@keyframes flip {
		from {
			transform: rotateX(90deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.answer span {
			animation: none;
		}
	}
</style>
