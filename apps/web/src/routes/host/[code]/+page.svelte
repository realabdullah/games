<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ConnectionGate from '$lib/components/ConnectionGate.svelte';
	import PlayerList from '$lib/components/PlayerList.svelte';
	import { t } from '$lib/i18n';
	import { RoomConnection } from '$lib/room.svelte';
	import { clearSession, loadSession } from '$lib/sessions';

	const code = page.params.code!.toUpperCase();
	const session = loadSession('host', code);
	const conn = session ? new RoomConnection(session) : null;

	$effect(() => () => conn?.destroy());
	$effect(() => {
		if (conn?.ended) clearSession('host', code);
	});

	const joinUrl = `${page.url.host}/play`;

	function closeRoom() {
		conn?.send({ type: 'leave' });
		clearSession('host', code);
		goto('/');
	}
</script>

<svelte:head><title>{code} · {t.appName}</title></svelte:head>

{#if !conn}
	<main class="center">
		<div class="card panel">
			<p class="big">{t.status.invalid}</p>
			<a class="btn" href="/">{t.status.backHome}</a>
		</div>
	</main>
{:else}
	<ConnectionGate {conn}>
		{@const room = conn.room!}
		<main class="host">
			<header class="join card">
				<p class="how">
					{t.lobby.joinAt} <strong>{joinUrl}</strong>
					{t.lobby.withCode}
				</p>
				<p class="code" aria-label="Room code {code.split('').join(' ')}">{code}</p>
			</header>

			<section class="lobby" aria-live="polite">
				<div class="count">
					<h2>{t.lobby.players(room.players.length)}</h2>
					{#if room.audienceCount > 0}
						<span class="muted">{t.lobby.audience(room.audienceCount)}</span>
					{/if}
				</div>
				{#if room.players.length === 0}
					<p class="waiting">{t.lobby.waiting}</p>
				{:else}
					<PlayerList
						players={room.players}
						large
						onkick={(p) => conn.send({ type: 'kick', playerId: p.id })}
					/>
				{/if}
			</section>

			<footer>
				<p class="muted">{t.lobby.gamesSoon}</p>
				<button class="btn ghost small" onclick={closeRoom}>{t.lobby.closeRoom}</button>
			</footer>
		</main>
	</ConnectionGate>
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
		padding: 32px 24px;
		text-align: center;
	}
	.big {
		font-size: 1.4rem;
		font-weight: 750;
	}
	.host {
		display: grid;
		grid-template-rows: auto 1fr auto;
		gap: clamp(24px, 4vw, 48px);
		min-height: 100dvh;
		max-width: 1400px;
		margin: 0 auto;
		padding: clamp(20px, 4vw, 48px) var(--gutter);
	}
	.join {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px 32px;
		padding: clamp(16px, 3vw, 28px) clamp(20px, 4vw, 40px);
		background: var(--yellow);
		box-shadow: var(--shadow-lg);
	}
	.how {
		font-size: clamp(1.2rem, 2.5vw, 2rem);
		font-weight: 650;
	}
	.code {
		font-size: clamp(3.5rem, 10vw, 8rem);
		font-weight: 800;
		line-height: 1;
		letter-spacing: 0.12em;
		font-variant-numeric: tabular-nums;
	}
	.lobby {
		display: grid;
		align-content: start;
		gap: 20px;
	}
	.count {
		display: flex;
		align-items: baseline;
		gap: 14px;
	}
	h2 {
		font-size: clamp(1.6rem, 3vw, 2.4rem);
	}
	.waiting {
		font-size: 1.4rem;
		font-weight: 650;
		color: var(--ink-soft);
		animation: pulse 1.8s ease-in-out infinite;
	}
	@keyframes pulse {
		50% {
			opacity: 0.45;
		}
	}
	footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
</style>
