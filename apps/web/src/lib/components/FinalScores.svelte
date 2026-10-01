<script lang="ts">
	import type { LeaderboardEntry } from '@games/engine';
	import { t } from '$lib/i18n';
	import Leaderboard from './Leaderboard.svelte';

	/** The end-of-game screen shared by every game, on the big screen or a phone. */
	interface Props {
		leaderboard: LeaderboardEntry[];
		youId?: string | null;
		canControl: boolean;
		large?: boolean;
		onplayagain?: () => void;
		onendgame?: () => void;
	}
	let {
		leaderboard,
		youId = null,
		canControl,
		large = false,
		onplayagain,
		onendgame
	}: Props = $props();

	const m = t.trivia;
	const winner = $derived(leaderboard[0]);
	const you = $derived(leaderboard.find((e) => e.id === youId));
</script>

<section class="final" class:large>
	<div class="head">
		<p class="kicker">{m.finalTitle}</p>
		{#if you}
			<h2 class="title">{m.place(you.rank)}</h2>
			<p class="big">{m.points(you.score)}</p>
		{:else if winner}
			<p class="avatar" aria-hidden="true">{winner.avatar}</p>
			<h2 class="title">{winner.name} {m.wins}</h2>
		{/if}
	</div>
	<div class="board"><Leaderboard entries={leaderboard} {youId} showDelta={false} {large} /></div>
	{#if canControl}
		<div class="actions">
			<button class="btn pink" onclick={onplayagain}>{m.playAgain}</button>
			<button class="btn ghost" onclick={onendgame}>{m.backToLobby}</button>
		</div>
	{:else}
		<p class="muted center">{m.waitingForHost}</p>
	{/if}
</section>

<style>
	.final {
		display: grid;
		gap: 20px;
	}
	.head {
		display: grid;
		gap: 10px;
		justify-items: center;
		padding: 16px 0;
		text-align: center;
	}
	.kicker {
		font-weight: 750;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.9rem;
	}
	.title {
		font-size: clamp(2.4rem, 8vw, 3.5rem);
	}
	.large .title {
		font-size: clamp(3rem, 8vw, 6rem);
	}
	.big {
		font-size: 1.6rem;
		font-weight: 800;
	}
	.avatar {
		font-size: clamp(4rem, 10vw, 8rem);
		line-height: 1;
	}
	.board {
		width: min(100%, 760px);
		margin: 0 auto;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 12px;
	}
	.center {
		text-align: center;
	}
</style>
