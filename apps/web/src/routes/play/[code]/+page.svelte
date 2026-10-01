<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { api } from '$lib/api';
	import ConnectionGate from '$lib/components/ConnectionGate.svelte';
	import GamePicker from '$lib/components/GamePicker.svelte';
	import { gameUi } from '$lib/games/registry';
	import type { StartRequest } from '$lib/games/types';
	import PlayerList from '$lib/components/PlayerList.svelte';
	import ProfileForm from '$lib/components/ProfileForm.svelte';
	import { t } from '$lib/i18n';
	import { RoomConnection } from '$lib/room.svelte';
	import { clearSession, loadSession, saveSession, type Profile } from '$lib/sessions';

	const code = page.params.code!.toUpperCase();
	let conn = $state<RoomConnection | null>(null);

	const existing = loadSession('play', code);
	if (existing) conn = new RoomConnection(existing);

	$effect(() => () => conn?.destroy());

	async function join(profile: Profile) {
		const res = await api.joinRoom(code, profile);
		saveSession('play', res.code, res.session);
		conn = new RoomConnection(res.session);
	}

	// A dead session (room gone, kicked) shouldn't stick around for next time.
	$effect(() => {
		if (conn?.ended) clearSession('play', code);
	});

	let lastStart: StartRequest | null = null;
	function start(req: StartRequest) {
		lastStart = req;
		conn?.send({ type: 'start', ...req });
	}

	function leave() {
		conn?.send({ type: 'leave' });
		clearSession('play', code);
		goto('/');
	}
</script>

<svelte:head><title>{code} · {t.appName}</title></svelte:head>

{#if !conn}
	<main class="narrow">
		<a href="/play" class="back">← {t.join.title}</a>
		<h1>Room <span class="code">{code}</span></h1>
		<ProfileForm submitLabel={t.join.submit} submittingLabel={t.join.submitting} onsubmit={join} />
	</main>
{:else}
	<ConnectionGate {conn}>
		{@const room = conn.room!}
		{@const you = conn.you!}
		{@const vip = room.players.find((p) => p.vip)}
		{#if room.phase === 'playing' && conn.game}
			<main class="narrow">
				<header class="top small">
					<span class="code">{code}</span>
					<span class="actions">
						{#if you.vip}
							<button class="btn ghost small" onclick={() => conn?.send({ type: 'endGame' })}>
								{t.lobby.endGame}
							</button>
						{/if}
						<button class="btn ghost small" onclick={leave}>{t.lobby.leave}</button>
					</span>
				</header>
				{#if gameUi[conn.game.gameId]}
					{@const Screen = gameUi[conn.game.gameId]!.Player}
					<Screen
						view={conn.game.view}
						clockOffset={conn.clockOffset}
						stream={conn.stream}
						youId={you.id}
						audience={you.role === 'audience'}
						canControl={you.vip}
						onaction={(action) => conn?.send({ type: 'action', action })}
						onplayagain={() => start(lastStart ?? { gameId: conn!.game!.gameId })}
						onendgame={() => conn?.send({ type: 'endGame' })}
					/>
				{/if}
				{#if conn.error}<p class="error" role="alert">{conn.error}</p>{/if}
			</main>
		{:else}
			<main class="narrow">
				<header class="top">
					<span class="code">{code}</span>
					<button class="btn ghost small" onclick={leave}>{t.lobby.leave}</button>
				</header>

				<div class="card status">
					{#if you.role === 'audience'}
						<p>{t.lobby.youAreAudience}</p>
					{:else if you.vip}
						<p>{t.lobby.youAreVip}</p>
					{:else if room.mode === 'party'}
						<p>{t.lobby.waitingForHost}</p>
					{:else}
						<p>{t.lobby.waitingForVip(vip?.name ?? 'the host')}</p>
					{/if}
				</div>

				<h2>{t.lobby.players(room.players.length)}</h2>
				<PlayerList
					players={room.players}
					youId={you.id}
					onkick={you.vip ? (p) => conn?.send({ type: 'kick', playerId: p.id }) : undefined}
				/>

				{#if you.vip}
					<div class="card pick">
						<GamePicker
							mode={room.mode}
							playerCount={room.players.length}
							onstart={start}
							settings={room.settings}
							onsettings={(st) => conn?.send({ type: 'settings', familyFilter: st.familyFilter })}
						/>
					</div>
				{/if}
				{#if conn.error}<p class="error" role="alert">{conn.error}</p>{/if}
			</main>
		{/if}
	</ConnectionGate>
{/if}

<style>
	.narrow {
		display: grid;
		gap: 20px;
		max-width: 560px;
		margin: 0 auto;
		padding: 24px var(--gutter) 48px;
	}
	.back {
		font-weight: 700;
		text-decoration: none;
	}
	h1 {
		font-size: 2.4rem;
	}
	.code {
		font-weight: 800;
		letter-spacing: 0.12em;
	}
	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 1.5rem;
	}
	.actions {
		display: flex;
		gap: 8px;
	}
	.top.small {
		font-size: 1.1rem;
	}
	.pick {
		padding: 20px;
	}
	.status {
		padding: 20px;
		background: var(--teal);
		font-size: 1.2rem;
		font-weight: 700;
	}
	h2 {
		font-size: 1.4rem;
	}
</style>
