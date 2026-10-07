<script lang="ts">
	import Motif from '$lib/components/Motif.svelte';
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
			<span class="avatar" aria-hidden="true"><Motif id={e.avatar} /></span>
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
	}
	.large .row {
		padding: 14px 22px;
		font-size: 1.4rem;
	}
	.you {
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
	}
	.rank {
		font-family: var(--display);
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
		color: var(--madder);
		font-weight: 750;
		font-variant-numeric: tabular-nums;
	}
	.score {
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
</style>
