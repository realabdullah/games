<script lang="ts">
	import type { MemoryView } from '@games/memory';
	import FinalScores from '$lib/components/FinalScores.svelte';
	import SittingOut from '$lib/components/SittingOut.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import type { PlayerViewProps } from '$lib/games/types';
	import { t } from '$lib/i18n';
	import MemoryGrid from './MemoryGrid.svelte';

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
	const view = $derived(raw as MemoryView);
	const you = $derived(view.you);
	const m = t.memory;
	const g = t.games;
	const next = () => onaction({ type: 'next' });

	/** Taps shown straight away, before the server says right or wrong. */
	let pending = $state<{ round: number; tiles: number[] }>({ round: -1, tiles: [] });
	const pendingTiles = $derived(pending.round === view.round ? pending.tiles : []);
	const right = $derived(you?.picks.filter((p) => p.right).length ?? 0);
	const failed = $derived(you?.picks.some((p) => !p.right) ?? false);

	function pick(index: number) {
		if (view.phase !== 'recall' || !you || you.done || pendingTiles.includes(index)) return;
		pending = { round: view.round, tiles: [...pendingTiles, index] };
		onaction({ type: 'pick', index });
	}
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
	{:else if view.phase !== 'final'}
		<header class="top">
			<p class="kicker">{m.roundOf(view.round + 1, view.rounds)}</p>
			{#if view.phase === 'recall'}<p class="found">{m.found(right, view.count)}</p>{/if}
		</header>
		<p
			class="status"
			class:bad={view.phase === 'recall' && failed}
			class:good={view.phase === 'recall' && you?.done && !failed}
			role="status"
		>
			{#if view.phase === 'show'}
				{m.watch}
			{:else if view.phase === 'recall'}
				{failed ? m.oops : you?.done ? m.perfect : m.tapThem(view.count)}
			{:else if you}
				{#if you.points > 0}<span class="points">{g.points(you.points)}</span>{/if}
				{t.trivia.scoreLine(you.score, you.rank ?? 1, view.leaderboard.length)}
			{/if}
		</p>
		{#key view.round}
			<MemoryGrid
				size={view.size}
				lit={view.tiles}
				picks={view.phase === 'show' ? [] : (you?.picks ?? [])}
				pending={pendingTiles}
				disabled={view.phase !== 'recall' || !you || you.done}
				ontap={pick}
			/>
		{/key}
		{#if view.phase !== 'reveal'}
			<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} />
		{/if}
		{#if canControl}
			{#if view.phase === 'recall'}
				<button class="btn ghost small" onclick={next}>{g.skip}</button>
			{:else if view.phase === 'reveal'}
				<button class="btn pink" onclick={next}>{g.next}</button>
			{/if}
		{/if}
	{:else}
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
		gap: 14px;
	}
	.center {
		display: grid;
		gap: 14px;
		justify-items: center;
		padding: 24px 0;
		text-align: center;
	}
	.huge {
		font-size: clamp(2.4rem, 10vw, 3.5rem);
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}
	.kicker {
		font-weight: 750;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.9rem;
	}
	.found {
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}
	.status {
		display: grid;
		place-items: center;
		min-height: 2.8em;
		border-radius: var(--radius-sm);
		font-weight: 800;
		font-size: 1.15rem;
		text-align: center;
	}
	.good {
		background: var(--teal);
	}
	.bad {
		color: oklch(50% 0.17 25);
	}
	.points {
		font-size: 1.4rem;
		color: oklch(45% 0.13 160);
	}
</style>
