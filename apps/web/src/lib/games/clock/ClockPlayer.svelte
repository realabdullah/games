<script lang="ts">
	import type { ClockView } from '@games/clock';
	import { untrack } from 'svelte';
	import FinalScores from '$lib/components/FinalScores.svelte';
	import SittingOut from '$lib/components/SittingOut.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import type { PlayerViewProps } from '$lib/games/types';
	import { t } from '$lib/i18n';
	import ClockResults from './ClockResults.svelte';
	import { seconds } from './format';

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
	const view = $derived(raw as ClockView);
	const you = $derived(view.you);
	const m = t.clock;
	const g = t.games;
	const next = () => onaction({ type: 'next' });

	const phase = $derived(view.phase);
	const round = $derived(view.round);
	const startsAt = $derived(view.startsAt);

	/**
	 * When the hidden clock starts on this screen. Fixed once per round, so a
	 * clock-sync update mid-round can't stretch or shrink anyone's time.
	 */
	let startLocal = 0;
	let started = $state(false);
	let tappedRound = $state(-1);

	$effect(() => {
		if (phase !== 'ready' && phase !== 'run') return;
		startLocal = startsAt - untrack(() => clockOffset);
		const wait = startLocal - Date.now();
		started = wait <= 0;
		if (started) return;
		const timer = setTimeout(() => (started = true), wait);
		return () => clearTimeout(timer);
	});

	const tapped = $derived(you?.tapped || tappedRound === round);
	const canTap = $derived(started && !tapped && (phase === 'ready' || phase === 'run'));

	function tap() {
		if (!canTap) return;
		tappedRound = round;
		onaction({ type: 'tap', ms: Date.now() - startLocal });
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
	{:else if view.phase !== 'final' && view.target !== null}
		<header class="top">
			<p class="kicker">{m.roundOf(view.round + 1, view.rounds)}</p>
			{#if view.phase === 'run'}<p>{m.tappedCount(view.tappedCount, view.playerCount)}</p>{/if}
		</header>
		<p class="target">{m.target(seconds(view.target, 1))}</p>

		{#if view.phase === 'reveal'}
			{#if you}
				<p class="score">
					{#if you.points > 0}<span class="points">{g.points(you.points)}</span>{/if}
					{t.trivia.scoreLine(you.score, you.rank ?? 1, view.leaderboard.length)}
				</p>
			{/if}
			<ClockResults results={view.results} target={view.target} {youId} />
			{#if canControl}<button class="btn pink" onclick={next}>{g.next}</button>{/if}
		{:else if you}
			{#if !started}
				<Timer endsAt={view.startsAt} durationMs={view.durationMs} {clockOffset} />
			{/if}
			{#if tapped}
				<p class="done card">{m.tapped}</p>
			{:else}
				<!-- pointerdown, not click: a click lands later, and every millisecond counts. -->
				<button
					class="tap"
					class:live={started}
					disabled={!started}
					aria-label={m.tapLabel(seconds(view.target, 1))}
					onpointerdown={tap}
					onclick={(e) => e.detail === 0 && tap()}
				>
					{started ? m.tap : m.getSet}
				</button>
				{#if started}<p class="hint">{m.countInHead}</p>{/if}
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
		font-weight: 750;
	}
	.kicker {
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.9rem;
	}
	.target {
		font-size: clamp(2.2rem, 11vw, 3.4rem);
		font-weight: 800;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}
	.tap {
		justify-self: center;
		width: min(72vw, 280px);
		aspect-ratio: 1;
		border: var(--border);
		border-radius: 50%;
		background: var(--surface);
		box-shadow: 0 6px 0 var(--line);
		font: inherit;
		font-size: 2rem;
		font-weight: 800;
		color: var(--ink-soft);
		touch-action: manipulation;
		user-select: none;
		-webkit-user-select: none;
		-webkit-tap-highlight-color: transparent;
	}
	.tap.live {
		background: var(--pink);
		color: var(--ink);
		cursor: pointer;
	}
	.tap.live:active {
		translate: 0 4px;
		box-shadow: 0 2px 0 var(--line);
	}
	.done {
		padding: 14px;
		background: var(--teal);
		font-weight: 800;
		text-align: center;
	}
	.hint {
		text-align: center;
		color: var(--ink-soft);
	}
	.score {
		display: grid;
		gap: 4px;
		text-align: center;
	}
	.points {
		font-size: 1.6rem;
		font-weight: 800;
		color: oklch(45% 0.13 160);
	}
</style>
