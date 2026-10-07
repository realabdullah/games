<script lang="ts">
	import type { AnagramView } from '@games/anagram';
	import FinalScores from '$lib/components/FinalScores.svelte';
	import Finishers from '$lib/components/Finishers.svelte';
	import Leaderboard from '$lib/components/Leaderboard.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import WordMask from '$lib/components/WordMask.svelte';
	import type { HostViewProps } from '$lib/games/types';
	import { t } from '$lib/i18n';
	import Letters from './Letters.svelte';

	let { view: raw, clockOffset, onaction, onplayagain, onendgame }: HostViewProps = $props();
	const view = $derived(raw as AnagramView);
	const m = t.anagram;
	const g = t.games;
	const next = () => onaction({ type: 'next' });
</script>

<section class="host">
	{#if view.phase === 'intro'}
		<div class="center">
			<h2 class="title">Anagram Race</h2>
			<p class="big">{m.howTo}</p>
			<p class="example" aria-hidden="true">TEALPN → PLANET</p>
			<div class="timer">
				<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} large />
			</div>
			<button class="btn" onclick={next}>{g.startNow}</button>
		</div>
	{:else if (view.phase === 'solve' || view.phase === 'reveal') && view.letters}
		<header class="top">
			<p class="kicker">{m.wordOf(view.round + 1, view.rounds)}</p>
			<p class="category">{view.category ?? m.letters(view.letters.length)}</p>
		</header>
		<div class="stage">
			<div class="main">
				{#key view.round}<Letters letters={view.letters} large />{/key}
				<WordMask mask={view.mask} large />
				{#if view.phase === 'solve'}
					<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} large />
				{/if}
			</div>
			<aside class="side">
				{#if view.phase === 'solve'}
					<p class="count">{m.solved(view.solvedCount, view.playerCount)}</p>
					<Finishers players={view.solvers} empty={m.noneYet} first={m.first} />
				{:else}
					<Leaderboard entries={view.leaderboard} limit={5} />
				{/if}
			</aside>
		</div>
		<footer>
			{#if view.phase === 'solve'}
				<button class="btn ghost small" onclick={next}>{g.skip}</button>
			{:else}
				<button class="btn primary" onclick={next}>{g.next}</button>
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
		font-family: var(--display);
		font-weight: 400;
	}
	.example {
		font-size: clamp(1.3rem, 2.4vw, 2rem);
		font-weight: 750;
		color: var(--ink-soft);
		letter-spacing: 0.1em;
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
	.category {
		padding: 4px 16px;
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
		font-size: clamp(1.1rem, 2vw, 1.6rem);
		font-weight: 800;
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
