<script lang="ts">
	import { FLAVOUR, flavourItems, type TriviaPack } from '@games/content';
	import { createAnagram } from '@games/anagram';
	import { clock } from '@games/clock';
	import { emoji } from '@games/emoji';
	import { findIt } from '@games/findit';
	import type { AnyGame } from '@games/engine';
	import { hangman } from '@games/hangman';
	import { maths } from '@games/maths';
	import { memory } from '@games/memory';
	import { trivia } from '@games/trivia';
	import { createWordRace } from '@games/wordrace';
	import { xo } from '@games/xo';
	import { trackEvent } from '$lib/analytics';
	import { api } from '$lib/api';
	import GamePicker from '$lib/components/GamePicker.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { gameUi, noStream } from '$lib/games/registry';
	import type { StartRequest } from '$lib/games/types';
	import { t } from '$lib/i18n';
	import { LocalGame } from '$lib/local-game.svelte';
	import { myPacks } from '$lib/my-packs.svelte';
	import { loadProfile } from '$lib/sessions';

	let { data } = $props();
	const entry = $derived(data.game);

	/**
	 * Games that can run in the browser, with how to load them and their content.
	 * Content and the dictionary load only when you start, so they never slow the page down.
	 */
	const solo: Record<
		string,
		{ game: () => Promise<AnyGame>; content: (req: StartRequest) => Promise<unknown> }
	> = {
		trivia: { game: async () => trivia, content: (req) => loadPack(req.packId ?? 'general') },
		xo: { game: async () => xo, content: async () => null },
		wordrace: {
			game: async () => createWordRace((await import('@games/content/dictionary')).isWord),
			content: async () => (await import('@games/content/packs/wordrace')).wordRacePack
		},
		hangman: {
			game: async () => hangman,
			content: async () => (await import('@games/content/packs/hangman')).hangmanPack
		},
		emoji: {
			game: async () => emoji,
			content: async (req) => {
				const flavour = req.config?.flavour ?? FLAVOUR.naija;
				const rounds = req.config?.rounds ?? emoji.defaultConfig.rounds;
				const [{ emojiPacks }, ai] = await Promise.all([
					import('@games/content/packs/emoji'),
					// One extra request, only when AI-written is on. If it fails, play curated.
					req.config?.ai ? api.aiItems('emoji', flavour, rounds).catch(() => null) : null
				]);
				const curated = shuffle(flavourItems(emojiPacks, flavour));
				const items = [...(ai?.items ?? []), ...curated].slice(0, rounds);
				return { id: 'curated', title: 'Curated', items };
			}
		},
		maths: { game: async () => maths, content: async () => null },
		clock: { game: async () => clock, content: async () => null },
		findit: { game: async () => findIt, content: async () => null },
		anagram: {
			game: async () => createAnagram((await import('@games/content/dictionary')).isWord),
			content: async () => (await import('@games/content/packs/anagram')).anagramPack
		},
		memory: { game: async () => memory, content: async () => null }
	};

	function shuffle<T>(items: readonly T[]): T[] {
		const out = [...items];
		for (let i = out.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[out[i], out[j]] = [out[j]!, out[i]!];
		}
		return out;
	}

	let game = $state<LocalGame<unknown> | null>(null);
	let lastStart: StartRequest | null = null;
	let error = $state<string | null>(null);

	/** Curated packs ship with the app; your own packs are fetched with their edit token. */
	async function loadPack(packId: string): Promise<TriviaPack | null> {
		const curated = (await import('@games/content/packs/trivia')).findTriviaPack(packId);
		if (curated) return curated;
		const mine = myPacks.get(packId);
		if (!mine) return null;
		const { pack } = await api.getPackForEdit(mine.code, mine.editToken);
		return { ...pack, id: mine.code };
	}

	async function start(req: StartRequest) {
		const def = solo[req.gameId];
		if (!def) return;
		error = null;
		let content: unknown;
		let definition: AnyGame;
		try {
			[definition, content] = await Promise.all([def.game(), def.content(req)]);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Something went wrong';
			return;
		}
		if (content === null && req.gameId === 'trivia') return;
		lastStart = req;
		trackEvent('game-start', `solo/${req.gameId}`);
		game?.destroy();
		const profile = loadProfile();
		game = new LocalGame(
			definition,
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

<Seo
	title="{t.solo.title(entry.name)} · {t.appName}"
	description={t.solo.intro[entry.id] ?? entry.tagline}
	path="/solo/{entry.id}"
	image="/og/{entry.id}.png"
/>

<main>
	{#if game?.view}
		{@const Screen = gameUi[entry.id]!.Player}
		<header class="top">
			<span class="kicker">{t.solo.title(entry.name)}</span>
			<button class="btn ghost small" onclick={quit}>{t.solo.quit}</button>
		</header>
		<Screen
			view={game.view}
			clockOffset={0}
			youId="you"
			audience={false}
			stream={noStream}
			canControl
			onaction={(action) => game?.send(action)}
			onplayagain={() => {
				if (lastStart) start(lastStart);
			}}
			onendgame={quit}
		/>
	{:else}
		<a href="/" class="back">← {t.appName}</a>
		<h1>{t.solo.title(entry.name)}</h1>
		<p class="muted">{t.solo.intro[entry.id] ?? entry.tagline}</p>
		<div class="card pick">
			<GamePicker
				mode="solo"
				playerCount={1}
				onstart={start}
				allowCode={false}
				onlyGame={entry.id}
			/>
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
