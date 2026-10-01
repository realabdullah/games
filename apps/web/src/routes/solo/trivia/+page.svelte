<script lang="ts">
	import { findTriviaPack, type TriviaPack } from '@games/content';
	import { api } from '$lib/api';
	import { myPacks } from '$lib/my-packs.svelte';
	import { trivia, type TriviaView } from '@games/trivia';
	import GamePicker from '$lib/components/GamePicker.svelte';
	import TriviaPlayer from '$lib/games/trivia/TriviaPlayer.svelte';
	import type { StartRequest } from '$lib/games/types';
	import { t } from '$lib/i18n';
	import { LocalGame } from '$lib/local-game.svelte';
	import { loadProfile } from '$lib/sessions';

	let game = $state<LocalGame<TriviaView> | null>(null);
	let lastStart: StartRequest | null = null;

	let error = $state<string | null>(null);

	/** Curated packs ship with the app; your own packs are fetched with their edit token. */
	async function loadPack(packId: string): Promise<TriviaPack | null> {
		const curated = findTriviaPack(packId);
		if (curated) return curated;
		const mine = myPacks.get(packId);
		if (!mine) return null;
		const { pack } = await api.getPackForEdit(mine.code, mine.editToken);
		return { ...pack, id: mine.code };
	}

	async function start(req: StartRequest) {
		error = null;
		let content: TriviaPack | null;
		try {
			content = await loadPack(req.packId ?? 'general');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Something went wrong';
			return;
		}
		if (!content) return;
		lastStart = req;
		game?.destroy();
		const profile = loadProfile();
		game = new LocalGame<TriviaView>(
			trivia,
			{ id: 'you', name: profile.name || 'You', avatar: profile.avatar },
			{ content, config: req.config }
		);
	}

	function quit() {
		game?.destroy();
		game = null;
	}

	$effect(() => () => game?.destroy());
</script>

<svelte:head>
	<title>{t.solo.title} · {t.appName}</title>
	<meta name="description" content={t.solo.intro} />
</svelte:head>

<main>
	{#if game?.view}
		<header class="top">
			<span class="kicker">{t.solo.title}</span>
			<button class="btn ghost small" onclick={quit}>{t.solo.quit}</button>
		</header>
		<TriviaPlayer
			view={game.view}
			clockOffset={0}
			youId="you"
			canControl
			onaction={(action) => game?.send(action)}
			onplayagain={() => lastStart && start(lastStart)}
			onendgame={quit}
		/>
	{:else}
		<a href="/" class="back">← {t.appName}</a>
		<h1>{t.solo.title}</h1>
		<p class="muted">{t.solo.intro}</p>
		<div class="card pick">
			<GamePicker mode="solo" playerCount={1} onstart={start} allowCode={false} />
			{#if error}<p class="error" role="alert">{error}</p>{/if}
		</div>
	{/if}
</main>

<style>
	main {
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
		font-size: 2.6rem;
	}
	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.kicker {
		font-weight: 800;
	}
	.pick {
		padding: 20px;
	}
</style>
