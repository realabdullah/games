<script lang="ts">
	import type { XoView } from '@games/xo';
	import FinalScores from '$lib/components/FinalScores.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import type { PlayerViewProps } from '$lib/games/types';
	import SittingOut from '$lib/components/SittingOut.svelte';
	import { t } from '$lib/i18n';
	import XoBoard from './XoBoard.svelte';
	import XoVersus from './XoVersus.svelte';

	let {
		view: raw,
		clockOffset,
		youId,
		audience,
		canControl,
		onaction,
		onplayagain,
		onendgame
	}: PlayerViewProps = $props();
	const view = $derived(raw as XoView);
	const you = $derived(view.you);
	const m = t.xo;
	const g = t.games;
	const next = () => onaction({ type: 'next' });
	const current = $derived(view.turn === 'X' ? view.x : view.o);
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
	{:else if view.phase === 'turn' || view.phase === 'result'}
		<p class="kicker">{m.matchOf(view.match + 1, view.matches)}</p>
		<XoVersus {view} />
		{#if view.phase === 'turn'}
			<p class="status" class:mine={you?.yourTurn} aria-live="polite">
				{#if you?.yourTurn}
					{m.yourTurn}
				{:else if you?.mark}
					{m.youAre(you.mark)} · {m.theirTurn(current?.name ?? '')}
				{:else}
					{m.theirTurn(current?.name ?? '')}
				{/if}
			</p>
		{:else}
			<p class="status result">
				{view.winner ? m.wins(view.winner.name) : m.draw}
				{#if you && you.points > 0}<span class="pts">{g.points(you.points)}</span>{/if}
			</p>
		{/if}
		<XoBoard
			board={view.board}
			winLine={view.winLine}
			onmove={you?.yourTurn ? (cell) => onaction({ type: 'move', cell }) : undefined}
		/>
		{#if view.phase === 'turn'}
			<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} />
		{/if}
		{#if !you?.mark && !audience}
			<p class="muted center-text">
				{view.upNext?.id === youId ? m.youreNext : m.watching}
			</p>
		{/if}
		{#if canControl && view.phase === 'result'}
			<button class="btn primary" onclick={next}>{g.next}</button>
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
		gap: 16px;
	}
	.center {
		display: grid;
		gap: 14px;
		justify-items: center;
		padding: 24px 0;
		text-align: center;
	}
	.center-text {
		text-align: center;
	}
	.kicker {
		font-weight: 700;
		color: var(--gold);
		text-transform: uppercase;
		letter-spacing: 0.16em;
		font-size: 0.9rem;
	}
	.huge {
		font-size: clamp(2.4rem, 10vw, 3.5rem);
	}
	.status {
		padding: 12px 16px;
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
		font-size: 1.2rem;
		font-weight: 800;
		text-align: center;
	}
	.mine {
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
		animation: nudge 500ms ease-out;
	}
	.result {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 10px;
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
	.pts {
		padding: 0 10px;
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
	}
	@keyframes nudge {
		30% {
			transform: scale(1.04);
		}
	}
</style>
