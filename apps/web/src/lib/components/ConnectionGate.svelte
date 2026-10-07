<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '$lib/i18n';
	import type { RoomConnection } from '$lib/room.svelte';

	/** Shows connecting/ended screens, and a reconnect banner over live content. */
	let { conn, children }: { conn: RoomConnection; children: Snippet } = $props();
</script>

{#if conn.status === 'ended'}
	<main class="center">
		<div class="card panel">
			<p class="big">{t.status[conn.ended ?? 'closed']}</p>
			<a class="btn" href="/">{t.status.backHome}</a>
		</div>
	</main>
{:else if !conn.room}
	<main class="center"><p class="big" aria-live="polite">{t.status.connecting}</p></main>
{:else}
	{#if conn.status === 'reconnecting'}
		<div class="banner" role="status">{t.status.reconnecting}</div>
	{/if}
	{@render children()}
{/if}

<style>
	.center {
		display: grid;
		place-items: center;
		min-height: 100dvh;
		padding: var(--gutter);
	}
	.panel {
		display: grid;
		gap: 20px;
		justify-items: center;
		max-width: 420px;
		padding: 32px 24px;
		text-align: center;
	}
	.big {
		font-size: 1.4rem;
		font-family: var(--display);
		font-weight: 400;
	}
	.banner {
		position: fixed;
		top: 12px;
		left: 50%;
		translate: -50% 0;
		z-index: 10;
		padding: 8px 18px;
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
		box-shadow: var(--shadow);
		font-weight: 750;
	}
</style>
