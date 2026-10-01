<script lang="ts">
	import { summarize, triviaPacks } from '@games/content';
	import type { GameMode } from '@games/engine';
	import { catalog } from '$lib/catalog';
	import type { StartRequest } from '$lib/games/types';
	import { t } from '$lib/i18n';

	interface Props {
		mode: GameMode;
		playerCount: number;
		onstart: (req: StartRequest) => void;
		busy?: boolean;
	}
	let { mode, playerCount, onstart, busy = false }: Props = $props();
	const uid = $props.id();

	const games = $derived(catalog.filter((g) => g.status === 'live' && g.modes.includes(mode)));
	const packs = triviaPacks.map(summarize);

	let gameId = $state('trivia');
	let packId = $state(packs[0]!.id);
	let questionCount = $state(10);
	let secondsPerQuestion = $state(20);

	const game = $derived(games.find((g) => g.id === gameId));
	const tooFew = $derived(!!game && playerCount < game.players.min);

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
			{#each packs as p (p.id)}
				<label class="pack" class:selected={p.id === packId}>
					<input type="radio" name="pack" value={p.id} bind:group={packId} class="sr-only" />
					<span aria-hidden="true">{p.emoji}</span>
					<span>{p.title}</span>
				</label>
			{/each}
		</fieldset>

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

	<button class="btn pink" onclick={start} disabled={busy || tooFew || !game}>
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
	.packs legend {
		grid-column: 1 / -1;
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
