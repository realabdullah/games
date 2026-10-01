<script lang="ts">
	import type { LeaderboardEntry } from '@games/engine';
	import { flip } from 'svelte/animate';

	interface Props {
		entries: LeaderboardEntry[];
		youId?: string | null;
		limit?: number;
		showDelta?: boolean;
		large?: boolean;
	}
	let { entries, youId = null, limit = 100, showDelta = true, large = false }: Props = $props();
</script>

<ol class="board" class:large>
	{#each entries.slice(0, limit) as e (e.id)}
		<li class="row card" class:you={e.id === youId} animate:flip={{ duration: 400 }}>
			<span class="rank">{e.rank}</span>
			<span class="avatar" aria-hidden="true">{e.avatar}</span>
			<span class="name">{e.name}</span>
			{#if showDelta && e.delta > 0}<span class="delta">+{e.delta}</span>{/if}
			<span class="score">{e.score.toLocaleString()}</span>
		</li>
	{/each}
</ol>

<style>
	.board {
		display: grid;
		gap: 10px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.row {
		display: grid;
		grid-template-columns: 2ch auto 1fr auto auto;
		align-items: center;
		gap: 12px;
		padding: 10px 16px;
		box-shadow: 3px 3px 0 var(--line);
	}
	.large .row {
		padding: 14px 22px;
		font-size: 1.4rem;
	}
	.you {
		background: var(--yellow);
	}
	.rank {
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}
	.avatar {
		font-size: 1.5em;
		line-height: 1;
	}
	.name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 750;
	}
	.delta {
		color: oklch(50% 0.14 160);
		font-weight: 750;
		font-variant-numeric: tabular-nums;
	}
	.score {
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}
</style>
