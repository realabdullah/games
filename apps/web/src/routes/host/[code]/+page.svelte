<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ConnectionGate from '$lib/components/ConnectionGate.svelte';
	import Dye from '$lib/components/Dye.svelte';
	import GamePicker from '$lib/components/GamePicker.svelte';
	import type { StartRequest } from '$lib/games/types';
	import { trackEvent } from '$lib/analytics';
	import { gameUi } from '$lib/games/registry';
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

	let lastStart: StartRequest | null = null;
	function start(req: StartRequest) {
		lastStart = req;
		trackEvent('game-start', `party/${req.gameId}`);
		conn?.send({ type: 'start', ...req });
	}

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
		<Dye game={room.phase === 'playing' ? conn.game?.gameId : null} />
		{#if room.phase === 'playing' && conn.game}
			<main class="host playing">
				<header class="bar">
					<span class="muted">{t.lobby.joinAt} <strong>{joinUrl}</strong></span>
					<span class="bar-end">
						<button class="btn ghost small" onclick={() => conn.send({ type: 'endGame' })}>
							{t.lobby.endGame}
						</button>
						<span class="mini-code">{code}</span>
					</span>
				</header>
				{#if gameUi[conn.game.gameId]}
					{@const Screen = gameUi[conn.game.gameId]!.Host}
					<Screen
						view={conn.game.view}
						clockOffset={conn.clockOffset}
						stream={conn.stream}
						onaction={(action) => conn.send({ type: 'action', action })}
						onplayagain={() => start(lastStart ?? { gameId: conn.game!.gameId })}
						onendgame={() => conn.send({ type: 'endGame' })}
					/>
				{/if}
			</main>
		{:else}
			{@const empty = room.players.length === 0}
			<main class="host">
				<header class="join">
					<p class="how">
						{t.lobby.joinAt} <strong>{joinUrl}</strong>
						{t.lobby.withCode}
					</p>
					<p class="code" aria-label="Room code {code.split('').join(' ')}">
						{#each code.split('') as letter, i (i)}
							<span class="surface" aria-hidden="true">{letter}</span>
						{/each}
					</p>
				</header>

				<!-- Until someone joins, the game picker gets the whole width. -->
				<div class="split" class:empty>
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
					<aside class="pick" class:card={!empty}>
						<GamePicker
							wide={empty}
							mode={room.mode}
							playerCount={room.players.length}
							onstart={start}
							settings={room.settings}
							onsettings={(st) => conn?.send({ type: 'settings', familyFilter: st.familyFilter })}
						/>
						{#if conn.error}<p class="error" role="alert">{conn.error}</p>{/if}
					</aside>
				</div>

				<footer>
					<button class="btn ghost small" onclick={closeRoom}>{t.lobby.closeRoom}</button>
				</footer>
			</main>
		{/if}
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
		font-family: var(--display);
		font-size: 1.6rem;
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
	}
	.how {
		max-width: 20ch;
		font-size: clamp(1.2rem, 2.5vw, 2rem);
		color: var(--ink-soft);
	}
	.how strong {
		display: block;
		font-family: var(--display);
		font-weight: 400;
		font-size: 1.35em;
		color: var(--ink);
	}
	.code {
		display: flex;
		gap: clamp(6px, 1vw, 12px);
	}
	.code span {
		display: grid;
		place-items: center;
		min-width: 1.05em;
		height: 1.2em;
		padding: 0 0.08em;
		border-radius: var(--radius);
		background: var(--starch);
		--ink: var(--indigo);
		--ink-soft: var(--faded);
		--line: var(--indigo);
		--border: 1.5px solid var(--indigo);
		--stitch: 1.5px dashed var(--indigo);
		--good: #1d6a43;
		--danger: var(--madder);
		--warn: #855700;
		color: var(--ink);
		font-family: var(--display);
		font-size: clamp(3.5rem, 9vw, 7rem);
		line-height: 1;
	}
	.code span:last-child {
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
		justify-content: flex-end;
	}
	.split {
		display: grid;
		gap: 24px;
		align-items: start;
	}
	@media (min-width: 960px) {
		.split:not(.empty) {
			grid-template-columns: 1fr minmax(340px, 420px);
		}
	}
	.empty .lobby {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 8px 20px;
	}
	.pick {
		display: grid;
		gap: 12px;
	}
	.pick.card {
		padding: 20px;
	}
	.playing {
		grid-template-rows: auto 1fr;
	}
	.bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		font-size: clamp(1rem, 1.5vw, 1.3rem);
	}
	.bar-end {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.mini-code {
		padding: 4px 14px;
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
		color: var(--indigo);
		font-family: var(--display);
		letter-spacing: 0.12em;
	}
</style>
