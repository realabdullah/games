<script lang="ts">
	import Motif from '$lib/components/Motif.svelte';
	import { PERFECT_MS, type ClockRound } from '@games/clock';
	import type { LeaderboardEntry } from '@games/engine';
	import { t } from '$lib/i18n';
	import { seconds } from './format';

	/** Every round side by side: one row per player, one column per round. */
	let {
		history,
		players,
		youId = null,
		large = false
	}: {
		history: ClockRound[];
		/** In leaderboard order. */
		players: LeaderboardEntry[];
		youId?: string | null;
		large?: boolean;
	} = $props();
	const m = t.clock;

	/** The closest tap in each round, to highlight. */
	const best = $derived(
		history.map((round) =>
			Math.min(...Object.values(round.taps).map((ms) => Math.abs(ms - round.target)))
		)
	);
	const signed = (ms: number) => `${ms < 0 ? '−' : '+'}${(Math.abs(ms) / 1000).toFixed(2)}`;
</script>

<section class="history" class:large>
	<!-- Many rounds scroll sideways here, never the page. -->
	<div class="scroll">
		<table>
			<caption class="sr-only">{m.everyRound}</caption>
			<thead>
				<tr>
					<th scope="col"><span class="sr-only">{m.player}</span></th>
					{#each history as round, i (i)}
						<th scope="col">
							{m.roundShort(i + 1)}
							<span class="target">{m.targetShort(seconds(round.target, 1))}</span>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each players as p (p.id)}
					<tr class:you={p.id === youId}>
						<th scope="row">
							<span aria-hidden="true"><Motif id={p.avatar} /></span>
							<span class="name">{p.name}</span>
						</th>
						{#each history as round, i (i)}
							{@const ms = round.taps[p.id]}
							{@const off = ms === undefined ? null : ms - round.target}
							<td
								class:best={off !== null && Math.abs(off) === best[i]}
								class:perfect={off !== null && Math.abs(off) <= PERFECT_MS}
							>
								{#if ms === undefined}
									<span class="none" aria-label={m.noTap}>–</span>
								{:else}
									<span class="time">{(ms / 1000).toFixed(2)}</span>
									<span class="off">{signed(off!)}</span>
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p class="legend">{m.historyLegend}</p>
</section>

<style>
	.history {
		display: grid;
		gap: 8px;
	}
	.scroll {
		overflow-x: auto;
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
	table {
		width: 100%;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
	}
	th,
	td {
		padding: 6px 8px;
		border-bottom: 1px solid color-mix(in oklch, var(--line) 20%, transparent);
		text-align: center;
		white-space: nowrap;
	}
	tbody tr:last-child > * {
		border-bottom: 0;
	}
	thead th {
		font-size: 0.8rem;
		font-weight: 800;
		color: var(--ink-soft);
	}
	.target {
		display: block;
		color: var(--ink);
	}
	tbody th {
		/* The names stay put while the rounds scroll. */
		position: sticky;
		left: 0;
		z-index: 1;
		max-width: 9em;
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
		text-align: left;
		font-weight: 750;
	}
	.name {
		display: inline-block;
		max-width: 6.5em;
		overflow: hidden;
		text-overflow: ellipsis;
		vertical-align: bottom;
	}
	.time {
		display: block;
		font-weight: 800;
	}
	.off {
		display: block;
		font-size: 0.75em;
		color: var(--ink-soft);
	}
	.none {
		color: var(--ink-soft);
	}
	.best {
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
	.perfect .off {
		color: var(--good);
		font-weight: 800;
	}
	.you > th,
	.you > td {
		box-shadow:
			inset 0 3px 0 -1px var(--clay),
			inset 0 -3px 0 -1px var(--clay);
	}
	.legend {
		font-size: 0.85rem;
		color: var(--ink-soft);
	}
	.large {
		font-size: clamp(1rem, 1.6vw, 1.3rem);
	}
	.large thead th {
		font-size: 0.85em;
	}
</style>
