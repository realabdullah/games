<script lang="ts">
	import type { FindItView } from '@games/findit';
	import FinalScores from '$lib/components/FinalScores.svelte';
	import SittingOut from '$lib/components/SittingOut.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import type { PlayerViewProps } from '$lib/games/types';
	import { t } from '$lib/i18n';
	import FindGrid from './FindGrid.svelte';

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
	const view = $derived(raw as FindItView);
	const you = $derived(view.you);
	const m = t.findit;
	const g = t.games;
	const next = () => onaction({ type: 'next' });

	const lockedUntil = $derived(you?.lockedUntil ?? 0);
	let frozen = $state(false);
	$effect(() => {
		const wait = lockedUntil - clockOffset - Date.now();
		frozen = wait > 0;
		if (!frozen) return;
		const timer = setTimeout(() => (frozen = false), wait);
		return () => clearTimeout(timer);
	});
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
	{:else if view.phase === 'find' || view.phase === 'reveal'}
		<header class="top">
			<p class="kicker">{m.gridOf(view.round + 1, view.rounds)}</p>
			<p class="prompt">{view.find === null ? m.findOdd : m.find(view.find)}</p>
		</header>
		<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} />
		<!-- A fixed slot, so the grid never jumps under a finger. -->
		<p class="status" class:got={view.phase === 'find' && you?.found} role="status">
			{#if view.phase === 'find' && you?.found}
				{m.youFound} <span class="points">{g.points(you.points)}</span>
			{:else if view.phase === 'find' && frozen}
				<span class="frozen">{m.frozen}</span>
			{/if}
		</p>
		{#key view.round}
			<FindGrid
				cells={view.cells}
				size={view.size}
				answer={view.answer}
				misses={you?.misses ?? []}
				disabled={!you || you.found || frozen}
				ontap={(index) => onaction({ type: 'tap', index })}
			/>
		{/key}
		{#if view.phase === 'reveal' && you}
			<p class="score">
				{#if you.points > 0}<span class="points">{g.points(you.points)}</span>{/if}
				{t.trivia.scoreLine(you.score, you.rank ?? 1, view.leaderboard.length)}
			</p>
		{/if}
		{#if canControl}
			{#if view.phase === 'find'}
				<button class="btn ghost small" onclick={next}>{g.skip}</button>
			{:else}
				<button class="btn primary" onclick={next}>{g.next}</button>
			{/if}
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
		gap: 12px;
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
		font-weight: 700;
		color: var(--gold);
		text-transform: uppercase;
		letter-spacing: 0.16em;
		font-size: 0.9rem;
	}
	.prompt {
		padding: 2px 14px;
		border: 2px solid var(--line);
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
		font-size: 1.2rem;
		font-weight: 800;
	}
	.status {
		display: grid;
		place-items: center;
		min-height: 2.6em;
		border-radius: var(--radius-sm);
		font-weight: 800;
		text-align: center;
	}
	.status.got {
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
	.frozen {
		color: var(--danger);
	}
	.score {
		display: grid;
		gap: 4px;
		text-align: center;
	}
	.points {
		font-family: var(--display);
		font-weight: 400;
		color: var(--good);
	}
	.score .points {
		font-size: 1.6rem;
		color: var(--good);
	}
</style>
