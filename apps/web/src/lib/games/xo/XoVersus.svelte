<script lang="ts">
	import Motif from '$lib/components/Motif.svelte';
	import type { XoView } from '@games/xo';
	import { t } from '$lib/i18n';

	/** "Ada (X) vs Bob (O)", each with their motif, with whoever's turn it is lifted. */
	let { view, large = false }: { view: XoView; large?: boolean } = $props();
	const sides = $derived([
		{ mark: 'X' as const, player: view.x },
		{ mark: 'O' as const, player: view.o }
	]);
</script>

<div class="versus" class:large>
	{#each sides as side, i (side.mark)}
		{#if i === 1}<span class="vs">{t.xo.vs}</span>{/if}
		<div
			class="side side-{side.mark}"
			class:active={view.phase === 'turn' && view.turn === side.mark}
		>
			<span class="avatar" aria-hidden="true"><Motif id={side.player?.avatar ?? ''} /></span>
			<span class="name">{side.player?.name}</span>
			<span class="mark">{side.mark}</span>
		</div>
	{/each}
</div>

<style>
	.versus {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 10px;
	}
	.side {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
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
		transition:
			transform 160ms ease-out,
			box-shadow 160ms ease-out;
	}
	.side-O {
		flex-direction: row-reverse;
	}
	.active.side-X {
		background: var(--clay);
		--ink: var(--indigo);
		--ink-soft: var(--faded);
		--line: var(--indigo);
		--border: 1.5px solid var(--indigo);
		--stitch: 1.5px dashed var(--indigo);
		--good: #1d6a43;
		--danger: var(--madder);
		--warn: #855700;
		color: var(--ink);
		box-shadow: var(--shadow);
	}
	.active.side-O {
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
		box-shadow: var(--shadow);
	}
	.avatar {
		font-size: 1.6em;
		line-height: 1;
	}
	.name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 800;
	}
	.mark {
		margin-inline: auto 0;
		font-weight: 800;
	}
	.side-O .mark {
		margin-inline: 0 auto;
	}
	.vs {
		font-weight: 800;
		color: var(--ink-soft);
	}
	.large {
		font-size: clamp(1.1rem, 2vw, 1.6rem);
	}
	@media (max-width: 420px) {
		.versus:not(.large) {
			gap: 6px;
			font-size: 0.9rem;
		}
		.versus:not(.large) .side {
			gap: 6px;
			padding: 6px 10px;
		}
	}
</style>
