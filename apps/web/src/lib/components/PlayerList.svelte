<script lang="ts">
	import Motif from '$lib/components/Motif.svelte';
	import type { PlayerInfo } from '@games/protocol';
	import { t } from '$lib/i18n';
	import { flip } from 'svelte/animate';
	import { scale } from 'svelte/transition';

	interface Props {
		players: PlayerInfo[];
		/** The current viewer's id, to mark "you" and hide your own kick button. */
		youId?: string | null;
		onkick?: (player: PlayerInfo) => void;
		large?: boolean;
	}
	let { players, youId = null, onkick, large = false }: Props = $props();
</script>

<ul class="players" class:large>
	{#each players as p (p.id)}
		<li
			class="player card"
			class:offline={!p.connected}
			class:you={p.id === youId}
			animate:flip={{ duration: 250 }}
			in:scale={{ start: 0.6, duration: 280 }}
		>
			<span class="avatar" aria-hidden="true"><Motif id={p.avatar} /></span>
			<span class="name">
				{p.name}
				{#if p.vip}<span class="host">{t.lobby.host}</span>{/if}
			</span>
			{#if !p.connected}<span class="badge">{t.lobby.offline}</span>{/if}
			{#if onkick && p.id !== youId}
				<button class="kick" onclick={() => onkick(p)} aria-label={t.lobby.kick(p.name)}>×</button>
			{/if}
		</li>
	{/each}
</ul>

<style>
	.players {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 12px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.large {
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 16px;
	}
	.player {
		position: relative;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 14px;
		min-width: 0;
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
	.offline {
		opacity: 0.55;
	}
	.avatar {
		font-size: 1.75rem;
		line-height: 1;
	}
	.large .avatar {
		font-size: 2.5rem;
	}
	.name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 750;
	}
	.large .name {
		font-size: 1.4rem;
	}
	.host {
		margin-left: 4px;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--madder);
	}
	.badge {
		margin-left: auto;
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--ink-soft);
	}
	.kick {
		position: absolute;
		top: -12px;
		right: -12px;
		width: 32px;
		height: 32px;
		border: var(--border);
		border-radius: 50%;
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
		font: inherit;
		font-weight: 800;
		line-height: 1;
		cursor: pointer;
	}
	/* bigger hit area than it looks */
	.kick::after {
		content: '';
		position: absolute;
		inset: -8px;
	}
	@media (hover: hover) {
		.kick {
			opacity: 0;
		}
		.player:hover .kick,
		.kick:focus-visible {
			opacity: 1;
		}
		.kick:hover {
			background: var(--madder);
			color: var(--starch);
		}
	}
</style>
