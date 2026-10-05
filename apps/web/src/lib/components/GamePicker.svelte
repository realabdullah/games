<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { triviaPackSummaries } from '@games/content';
	import type { GameMode } from '@games/engine';
	import type { PackSummary, RoomSettings } from '@games/protocol';
	import { api } from '$lib/api';
	import { catalog } from '$lib/catalog';
	import { gameUi } from '$lib/games/registry';
	import type { StartRequest } from '$lib/games/types';
	import { t } from '$lib/i18n';
	import { myPacks } from '$lib/my-packs.svelte';
	import GeneratePack from './GeneratePack.svelte';

	interface Props {
		mode: GameMode;
		playerCount: number;
		onstart: (req: StartRequest) => void;
		busy?: boolean;
		/** Room settings; omitted in solo. */
		settings?: RoomSettings;
		onsettings?: (settings: RoomSettings) => void;
		/** Let hosts type someone else's pack code. Off in solo (it needs the full pack). */
		allowCode?: boolean;
		/** Only offer this game (solo pages are per game). */
		onlyGame?: string;
		/** Room to spare: games stay laid out in their own panel, beside the setup. */
		wide?: boolean;
	}
	let {
		mode,
		playerCount,
		onstart,
		busy = false,
		settings,
		onsettings,
		allowCode = true,
		onlyGame,
		wide = false
	}: Props = $props();
	const uid = $props.id();
	const p = t.picker;

	const games = $derived(
		catalog.filter(
			(g) => g.status === 'live' && g.modes.includes(mode) && (!onlyGame || g.id === onlyGame)
		)
	);
	/** Solo can have its own settings (e.g. the computer's level). */
	const settingsFor = (id: string) =>
		(mode === 'solo' && gameUi[id]?.soloSettings) || gameUi[id]?.settings || [];

	const curated = triviaPackSummaries;

	let gameId = $state(untrack(() => onlyGame) ?? 'trivia');
	let packId = $state(curated[0]!.id);
	let questionCount = $state(10);
	let secondsPerQuestion = $state(20);
	/** Settings for the other games, keyed by game then setting. */
	let extra = $state<Record<string, Record<string, number>>>(
		Object.fromEntries(
			Object.keys(gameUi).map((id) => [
				id,
				Object.fromEntries(untrack(() => settingsFor(id)).map((st) => [st.key, st.default]))
			])
		)
	);

	let code = $state('');
	let codePack = $state<PackSummary | null>(null);
	let codeError = $state<string | null>(null);

	const game = $derived(games.find((g) => g.id === gameId));
	// Solo games fill the other seats themselves (e.g. the computer in X-O).
	const tooFew = $derived(mode !== 'solo' && !!game && playerCount < game.players.min);
	const selectedFlagged = $derived(
		(codePack?.code === packId && codePack.flagged) ||
			!!myPacks.list.find((m) => m.code === packId)?.flagged
	);
	const blocked = $derived(selectedFlagged && !!settings?.familyFilter);

	/** Every pack the host can pick, ready-made first. */
	const packs = $derived([
		...curated.map((pk) => ({ id: pk.id, emoji: pk.emoji, title: pk.title, mine: false })),
		...myPacks.list.map((pk) => ({
			id: pk.code,
			emoji: pk.emoji ?? '🧠',
			title: pk.title,
			mine: true
		})),
		...(codePack && !myPacks.get(codePack.code)
			? [{ id: codePack.code, emoji: codePack.emoji ?? '🧠', title: codePack.title, mine: true }]
			: [])
	]);
	const pack = $derived(packs.find((pk) => pk.id === packId));

	/** Which list is open. Closed, only the current choice shows, so the panel stays short. */
	let choosing = $state<'game' | 'pack' | null>(null);
	let query = $state('');
	/** Long lists get a search box. */
	const SEARCH_FROM = 8;
	const matches = (text: string) => text.toLowerCase().includes(query.trim().toLowerCase());
	const shownGames = $derived(
		games.filter((g) => matches(`${g.name} ${g.tagline} ${g.tags.join(' ')}`))
	);
	const shownPacks = $derived(packs.filter((pk) => matches(pk.title)));

	let gameButton = $state<HTMLButtonElement>();
	let packButton = $state<HTMLButtonElement>();

	async function toggle(which: 'game' | 'pack') {
		choosing = choosing === which ? null : which;
		query = '';
		if (!choosing) return;
		await tick();
		document
			.getElementById(`${uid}-${which}s`)
			?.querySelector<HTMLElement>('input, [aria-pressed="true"]')
			?.focus();
	}

	async function close() {
		const back = choosing === 'game' ? gameButton : packButton;
		choosing = null;
		await tick();
		back?.focus();
	}

	function pickGame(id: string) {
		gameId = id;
		if (!wide) close();
	}

	function pickPack(id: string) {
		packId = id;
		close();
	}

	function onkeydown(e: KeyboardEvent) {
		if (choosing && e.key === 'Escape') {
			e.preventDefault();
			close();
		}
	}

	async function useCode(e: SubmitEvent) {
		e.preventDefault();
		codeError = null;
		try {
			codePack = await api.packSummary(code.trim());
			pickPack(codePack.code);
		} catch (err) {
			codeError = err instanceof Error ? err.message : 'Something went wrong';
		}
	}

	function start() {
		if (gameId === 'trivia') {
			onstart({ gameId, packId, config: { questionCount, secondsPerQuestion } });
		} else {
			onstart({ gameId, config: { ...extra[gameId] } });
		}
	}
</script>

<svelte:window {onkeydown} />

<div class="picker" class:wide>
	{#if !onlyGame && game}
		<section class="choice games" class:card={wide} aria-labelledby="{uid}-game-label">
			<h2 class="label" id="{uid}-game-label">{p.title}</h2>
			{#if !wide}
				<div class="current game card" style:--accent={game.color}>
					<span class="emoji" aria-hidden="true">{game.emoji}</span>
					<span class="text">
						<strong>{game.name}</strong>
						<span class="tagline">{game.tagline}</span>
					</span>
					{#if games.length > 1}
						<button
							type="button"
							class="btn ghost small"
							bind:this={gameButton}
							aria-expanded={choosing === 'game'}
							aria-controls="{uid}-games"
							onclick={() => toggle('game')}
						>
							{choosing === 'game' ? p.close : p.change}
						</button>
					{/if}
				</div>
			{/if}
			{#if wide || choosing === 'game'}
				<div class="chooser" id="{uid}-games" role="group" aria-labelledby="{uid}-game-label">
					{#if games.length >= SEARCH_FROM}
						<input
							class="input search"
							type="search"
							bind:value={query}
							placeholder={p.searchGames}
							aria-label={p.searchGames}
						/>
					{/if}
					<ul class="tiles">
						{#each shownGames as g (g.id)}
							<li>
								<button
									type="button"
									class="tile"
									style:--accent={g.color}
									aria-pressed={g.id === gameId}
									title={g.tagline}
									onclick={() => pickGame(g.id)}
								>
									<span class="emoji" aria-hidden="true">{g.emoji}</span>
									<span>{g.name}</span>
									{#if wide}<span class="tagline">{g.tagline}</span>{/if}
								</button>
							</li>
						{:else}
							<li class="muted">{p.noMatches}</li>
						{/each}
					</ul>
				</div>
			{/if}
		</section>
	{/if}

	<div class="setup" class:card={wide}>
		{#if wide && game}
			<h2 class="label setup-title">
				<span aria-hidden="true">{game.emoji}</span>
				{game.name}
			</h2>
		{/if}
		{#if gameId === 'trivia'}
			<section class="choice" aria-labelledby="{uid}-pack-label">
				<h2 class="label" id="{uid}-pack-label">{p.pack}</h2>
				<div class="current">
					<span class="pack chosen">
						<span aria-hidden="true">{pack?.emoji ?? '🧠'}</span>
						<span>{pack?.title ?? packId}</span>
					</span>
					<button
						type="button"
						class="btn ghost small"
						bind:this={packButton}
						aria-expanded={choosing === 'pack'}
						aria-controls="{uid}-packs"
						onclick={() => toggle('pack')}
					>
						{choosing === 'pack' ? p.close : p.change}
					</button>
				</div>
				{#if choosing === 'pack'}
					<div class="chooser" id="{uid}-packs" role="group" aria-labelledby="{uid}-pack-label">
						{#if packs.length >= SEARCH_FROM}
							<input
								class="input search"
								type="search"
								bind:value={query}
								placeholder={p.searchPacks}
								aria-label={p.searchPacks}
							/>
						{/if}
						{#each [{ name: p.curated, mine: false }, { name: p.myPacks, mine: true }] as group (group.name)}
							{@const list = shownPacks.filter((pk) => pk.mine === group.mine)}
							{#if list.length}
								<h3 class="group">{group.name}</h3>
								<ul class="pills">
									{#each list as pk (pk.id)}
										<li>
											<button
												type="button"
												class="pack"
												aria-pressed={pk.id === packId}
												onclick={() => pickPack(pk.id)}
											>
												<span aria-hidden="true">{pk.emoji}</span>
												<span>{pk.title}</span>
											</button>
										</li>
									{/each}
								</ul>
							{/if}
						{/each}
						{#if !shownPacks.length}<p class="muted">{p.noMatches}</p>{/if}

						{#if allowCode}
							<form class="code" onsubmit={useCode}>
								<label for="{uid}-code" class="sr-only">{p.code}</label>
								<input
									id="{uid}-code"
									class="input"
									bind:value={code}
									placeholder="{p.code}: {p.codePlaceholder}"
									maxlength="6"
									autocapitalize="characters"
									autocomplete="off"
									spellcheck="false"
								/>
								<button class="btn ghost small" disabled={code.trim().length !== 6}
									>{p.useCode}</button
								>
							</form>
							{#if codeError}<p class="error">{codeError}</p>{/if}
						{/if}
						<a class="make" href="/packs/new" target={settings ? '_blank' : undefined}
							>{p.makePack} →</a
						>
					</div>
				{/if}
				<GeneratePack onpack={(code) => (packId = code)} />
			</section>

			<div class="settings">
				<div class="field">
					<label for="{uid}-count">{t.picker.questions}</label>
					<select id="{uid}-count" class="input" bind:value={questionCount}>
						{#each [5, 10, 15] as n (n)}<option value={n}>{n}</option>{/each}
					</select>
				</div>
				<div class="field">
					<label for="{uid}-secs">{t.picker.seconds}</label>
					<select id="{uid}-secs" class="input" bind:value={secondsPerQuestion}>
						{#each [10, 20, 30] as n (n)}<option value={n}>{n}</option>{/each}
					</select>
				</div>
			</div>
		{:else if settingsFor(gameId).length}
			<div class="settings">
				{#each settingsFor(gameId) as st (st.key)}
					<div class="field" class:wide={!!st.labels}>
						<label for="{uid}-{st.key}">{st.label}</label>
						<select id="{uid}-{st.key}" class="input" bind:value={extra[gameId]![st.key]}>
							{#each st.options as n (n)}<option value={n}>{st.labels?.[n] ?? n}</option>{/each}
						</select>
					</div>
				{/each}
			</div>
		{/if}

		{#if settings && onsettings}
			<label class="toggle">
				<input
					type="checkbox"
					class="switch"
					checked={settings.familyFilter}
					onchange={(e) => onsettings({ ...settings, familyFilter: e.currentTarget.checked })}
				/>
				<span>
					<strong>{p.familyFilter}</strong>
					<span class="muted">{p.familyFilterHint}</span>
				</span>
			</label>
		{/if}

		{#if blocked}<p class="error">{t.packs.flagged}</p>{/if}

		<button class="btn pink" onclick={start} disabled={busy || tooFew || !game || blocked}>
			{busy ? t.picker.starting : t.picker.start}
		</button>
		{#if game && tooFew}<p class="muted hint">{t.picker.needPlayers(game.players.min)}</p>{/if}
	</div>
</div>

<style>
	.picker,
	.setup {
		display: grid;
		align-content: start;
		gap: 18px;
	}
	.wide {
		align-items: start;
		gap: 24px;
	}
	.wide .card {
		padding: 20px;
	}
	@media (min-width: 960px) {
		.wide {
			grid-template-columns: minmax(0, 1fr) minmax(340px, 420px);
		}
	}
	.setup-title {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 1.4rem;
	}
	.choice,
	.chooser {
		display: grid;
		gap: 10px;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.label {
		font-weight: 800;
		font-size: 1.1rem;
	}
	.current {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.current > .btn {
		flex: none;
		margin-left: auto;
	}
	.game {
		padding: 12px 14px;
		background: var(--accent);
		box-shadow: 3px 3px 0 var(--line);
	}
	.text {
		display: grid;
		min-width: 0;
	}
	.tagline {
		font-size: 0.95rem;
	}
	.emoji {
		font-size: 2rem;
	}
	.chooser {
		padding: 12px;
		border: 2px dashed var(--line);
		border-radius: var(--radius);
	}
	.wide .games .chooser {
		padding: 0;
		border: 0;
	}
	.search {
		min-height: 46px;
		font-size: 1rem;
	}
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
		gap: 10px;
	}
	.tile {
		display: grid;
		justify-items: center;
		align-content: center;
		gap: 4px;
		width: 100%;
		height: 100%;
		padding: 10px 8px;
		border: var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		color: inherit;
		font: inherit;
		font-weight: 700;
		line-height: 1.2;
		text-align: center;
		cursor: pointer;
	}
	.tile[aria-pressed='true'] {
		background: var(--accent);
		box-shadow: 3px 3px 0 var(--line);
	}
	.tile .emoji {
		font-size: 1.75rem;
	}
	.wide .tiles {
		grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
		gap: 14px;
	}
	.wide .tile {
		gap: 6px;
		padding: 18px 14px;
	}
	.wide .tile .emoji {
		font-size: 2.5rem;
	}
	.tile .tagline {
		font-weight: 400;
		color: var(--ink-soft);
	}
	.tile[aria-pressed='true'] .tagline {
		color: var(--ink);
	}
	.pills {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.group {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.pack {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
		padding: 8px 14px;
		border: var(--border);
		border-radius: 999px;
		background: var(--surface);
		color: inherit;
		font: inherit;
		font-weight: 700;
		line-height: 1.2;
		text-align: start;
	}
	button.pack {
		cursor: pointer;
	}
	.pack[aria-pressed='true'],
	.pack.chosen {
		background: var(--yellow);
		box-shadow: 3px 3px 0 var(--line);
	}
	.tile:focus-visible,
	.pack:focus-visible {
		outline: none;
		box-shadow: var(--focus-shadow);
	}
	.code {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: 8px;
	}
	.code .input {
		min-height: 46px;
		font-size: 1rem;
		text-transform: uppercase;
	}
	.code .input::placeholder {
		text-transform: none;
	}
	.make {
		justify-self: start;
		font-weight: 700;
	}
	.toggle {
		display: flex;
		align-items: center;
		gap: 12px;
		cursor: pointer;
	}
	.toggle > span {
		display: grid;
	}
	.settings {
		display: grid;
		grid-template-columns: 1fr 1fr;
		align-items: end;
		gap: 12px;
	}
	/* Settings with word options (e.g. the computer's level) get the full row. */
	.settings .wide {
		grid-column: 1 / -1;
	}
	.settings .input {
		min-height: 50px;
		padding-left: 0.75em;
		font-size: 1.05rem;
	}
	.hint {
		text-align: center;
	}
</style>
