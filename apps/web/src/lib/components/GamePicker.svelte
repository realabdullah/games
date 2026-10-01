<script lang="ts">
	import { summarize, triviaPacks } from '@games/content';
	import type { GameMode } from '@games/engine';
	import type { PackSummary, RoomSettings } from '@games/protocol';
	import { api } from '$lib/api';
	import { catalog } from '$lib/catalog';
	import type { StartRequest } from '$lib/games/types';
	import { t } from '$lib/i18n';
	import { myPacks } from '$lib/my-packs.svelte';

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
	}
	let {
		mode,
		playerCount,
		onstart,
		busy = false,
		settings,
		onsettings,
		allowCode = true
	}: Props = $props();
	const uid = $props.id();
	const p = t.picker;

	const games = $derived(catalog.filter((g) => g.status === 'live' && g.modes.includes(mode)));
	const curated = triviaPacks.map(summarize);

	let gameId = $state('trivia');
	let packId = $state(curated[0]!.id);
	let questionCount = $state(10);
	let secondsPerQuestion = $state(20);

	let code = $state('');
	let codePack = $state<PackSummary | null>(null);
	let codeError = $state<string | null>(null);

	const game = $derived(games.find((g) => g.id === gameId));
	const tooFew = $derived(!!game && playerCount < game.players.min);
	const selectedFlagged = $derived(
		(codePack?.code === packId && codePack.flagged) ||
			!!myPacks.list.find((m) => m.code === packId)?.flagged
	);
	const blocked = $derived(selectedFlagged && !!settings?.familyFilter);

	async function useCode(e: SubmitEvent) {
		e.preventDefault();
		codeError = null;
		try {
			codePack = await api.packSummary(code.trim());
			packId = codePack.code;
		} catch (err) {
			codeError = err instanceof Error ? err.message : 'Something went wrong';
		}
	}

	function start() {
		onstart({ gameId, packId, config: { questionCount, secondsPerQuestion } });
	}
</script>

<div class="picker">
	<fieldset class="games">
		<legend class="label">{t.picker.title}</legend>
		{#each games as g (g.id)}
			<label class="game card" class:selected={g.id === gameId} style:--accent={g.color}>
				<input type="radio" name="game" value={g.id} bind:group={gameId} class="sr-only" />
				<span class="emoji" aria-hidden="true">{g.emoji}</span>
				<span>
					<strong>{g.name}</strong>
					<span class="muted tagline">{g.tagline}</span>
				</span>
			</label>
		{/each}
	</fieldset>

	{#if gameId === 'trivia'}
		<fieldset class="packs">
			<legend class="label">{t.picker.pack}</legend>
			<span class="group">{p.curated}</span>
			{#each curated as pack (pack.id)}
				<label class="pack" class:selected={pack.id === packId}>
					<input
						type="radio"
						name="{uid}-pack"
						value={pack.id}
						bind:group={packId}
						class="sr-only"
					/>
					<span aria-hidden="true">{pack.emoji}</span>
					<span>{pack.title}</span>
				</label>
			{/each}
			{#if myPacks.list.length > 0 || codePack}
				<span class="group">{p.myPacks}</span>
				{#each myPacks.list as pack (pack.code)}
					<label class="pack" class:selected={pack.code === packId}>
						<input
							type="radio"
							name="{uid}-pack"
							value={pack.code}
							bind:group={packId}
							class="sr-only"
						/>
						<span aria-hidden="true">{pack.emoji ?? '🧠'}</span>
						<span>{pack.title}</span>
					</label>
				{/each}
				{#if codePack && !myPacks.get(codePack.code)}
					<label class="pack" class:selected={codePack.code === packId}>
						<input
							type="radio"
							name="{uid}-pack"
							value={codePack.code}
							bind:group={packId}
							class="sr-only"
						/>
						<span aria-hidden="true">{codePack.emoji ?? '🧠'}</span>
						<span>{codePack.title}</span>
					</label>
				{/if}
			{/if}
		</fieldset>

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
				<button class="btn ghost small" disabled={code.trim().length !== 6}>{p.useCode}</button>
			</form>
			{#if codeError}<p class="error">{codeError}</p>{/if}
		{/if}
		<a class="make" href="/packs/new" target={settings ? '_blank' : undefined}>{p.makePack} →</a>

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
	{/if}

	{#if settings && onsettings}
		<label class="toggle">
			<input
				type="checkbox"
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

<style>
	.picker {
		display: grid;
		gap: 18px;
	}
	fieldset {
		display: grid;
		gap: 10px;
		margin: 0;
		padding: 0;
		border: 0;
	}
	.label {
		margin-bottom: 8px;
		padding: 0;
		font-weight: 800;
		font-size: 1.1rem;
	}
	.game {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 12px 16px;
		cursor: pointer;
		box-shadow: 3px 3px 0 var(--line);
	}
	.game.selected {
		background: var(--accent);
	}
	.game > span:last-child {
		display: grid;
	}
	.tagline {
		font-size: 0.95rem;
	}
	.game.selected .tagline {
		color: var(--ink);
	}
	.emoji {
		font-size: 2rem;
	}
	.packs {
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
	}
	.packs legend,
	.group {
		grid-column: 1 / -1;
	}
	.group {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.06em;
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
		align-items: flex-start;
		gap: 12px;
		cursor: pointer;
	}
	.toggle input {
		width: 22px;
		height: 22px;
		margin-top: 2px;
		accent-color: var(--ink);
	}
	.toggle > span {
		display: grid;
	}
	.pack {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		border: var(--border);
		border-radius: 999px;
		background: var(--surface);
		font-weight: 700;
		cursor: pointer;
	}
	.pack.selected {
		background: var(--yellow);
		box-shadow: 3px 3px 0 var(--line);
	}
	.game:has(:focus-visible),
	.pack:has(:focus-visible) {
		outline: 3px solid var(--violet);
		outline-offset: 2px;
	}
	.settings {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	.hint {
		text-align: center;
	}
</style>
