<script lang="ts">
	import Motif from '$lib/components/Motif.svelte';
	import { PERFECT_MS, type ClockResult } from '@games/clock';
	import { t } from '$lib/i18n';
	import { seconds } from './format';

	let {
		results,
		target,
		youId = null,
		large = false
	}: { results: ClockResult[]; target: number; youId?: string | null; large?: boolean } = $props();
	const m = t.clock;

	function offBy(r: ClockResult): string {
		if (r.ms === null || r.off === null) return m.noTap;
		if (r.off <= PERFECT_MS) return m.perfect;
		return r.ms < target ? m.early(seconds(r.off)) : m.late(seconds(r.off));
	}
</script>

<ol class="results" class:large>
	{#each results as r, i (r.player.id)}
		<li class:you={r.player.id === youId} class:best={i === 0 && r.ms !== null}>
			<span aria-hidden="true"><Motif id={r.player.avatar} /></span>
			<strong class="name">{r.player.name}</strong>
			<span class="time">{r.ms === null ? '–' : seconds(r.ms)}</span>
			<span class="off">{offBy(r)}</span>
			<span class="points">{r.points ? t.games.points(r.points) : ''}</span>
		</li>
	{/each}
</ol>

<style>
	.results {
		display: grid;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		grid-template-areas: 'avatar name time' 'avatar off points';
		column-gap: 10px;
		align-items: center;
		padding: 8px 12px;
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
	li > span:first-child {
		grid-area: avatar;
		font-size: 1.5em;
	}
	.name {
		grid-area: name;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.time {
		grid-area: time;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}
	.off {
		grid-area: off;
		color: var(--ink-soft);
		font-size: 0.9em;
	}
	.points {
		grid-area: points;
		justify-self: end;
		font-family: var(--display);
		font-weight: 400;
		color: var(--good);
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
	.you {
		outline: 3px solid var(--clay);
		outline-offset: -1px;
	}
	.large {
		font-size: clamp(1rem, 1.8vw, 1.4rem);
	}
</style>
