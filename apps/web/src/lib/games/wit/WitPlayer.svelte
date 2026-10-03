<script lang="ts">
	import { MAX_ANSWER_LENGTH, type WitView } from '@games/wit';
	import FinalScores from '$lib/components/FinalScores.svelte';
	import TextAnswer from '$lib/components/TextAnswer.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import type { PlayerViewProps } from '$lib/games/types';
	import SittingOut from '$lib/components/SittingOut.svelte';
	import { t } from '$lib/i18n';

	let {
		view: raw,
		clockOffset,
		youId,
		audience,
		canControl,
		onaction,
		onplayagain,
		onendgame
	}: PlayerViewProps = $props();
	const view = $derived(raw as WitView);
	const you = $derived(view.you);
	const m = t.wit;
	const g = t.games;
	const next = () => onaction({ type: 'next' });

	const prompts = $derived(you?.prompts ?? []);
	const pending = $derived(prompts.find((p) => !p.answered));
	const answeredCount = $derived(prompts.filter((p) => p.answered).length);
</script>

<section class="play">
	{#if !you && !audience && view.phase !== 'final'}<SittingOut />{/if}
	{#if view.phase === 'intro'}
		<div class="center">
			<h2 class="huge">{g.getReady}</h2>
			<p>{m.howTo}</p>
			<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} />
			{#if canControl}<button class="btn" onclick={next}>{g.startNow}</button>{/if}
		</div>
	{:else if view.phase === 'write'}
		<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} />
		{#if pending}
			<p class="kicker">{m.promptOf(answeredCount + 1, prompts.length)}</p>
			<h2 class="prompt">{pending.prompt}</h2>
			{#key pending.match}
				<TextAnswer
					label={pending.prompt}
					maxLength={MAX_ANSWER_LENGTH}
					placeholder={m.placeholder}
					onsubmit={(text) => onaction({ type: 'answer', match: pending.match, text })}
				/>
			{/key}
		{:else}
			<p class="waiting card">
				{prompts.length ? m.allDone : g.done(view.doneCount, view.expectedCount)}
			</p>
		{/if}
		{#if canControl}<button class="btn ghost small" onclick={next}>{g.skip}</button>{/if}
	{:else if (view.phase === 'vote' || view.phase === 'result') && view.current}
		{@const c = view.current}
		<p class="kicker">{m.matchupOf(c.number, c.total)}</p>
		<h2 class="prompt">{c.prompt}</h2>
		{#if view.phase === 'vote'}
			<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} />
			{#if you?.inMatchup}
				<p class="note card">{m.yours}</p>
			{:else if you?.vote}
				<p class="waiting">{m.voted}</p>
			{:else if you}
				<p class="label">{m.vote}</p>
			{/if}
			<div class="options">
				{#each ['a', 'b'] as const as side (side)}
					<button
						class="option-btn side-{side}"
						class:picked={you?.vote === side}
						disabled={!you || you.inMatchup || !!you.vote}
						onclick={() => onaction({ type: 'vote', side })}
					>
						{c[side] ?? m.noAnswer}
					</button>
				{/each}
			</div>
			{#if canControl}<button class="btn ghost small" onclick={next}>{g.skip}</button>{/if}
		{:else if view.result}
			{#each ['a', 'b'] as const as side (side)}
				{@const res = view.result[side]}
				<div class="card res side-{side}" class:mine={res.player.id === youId}>
					<p class="text">{c[side] ?? m.noAnswer}</p>
					<p class="by">
						<span aria-hidden="true">{res.player.avatar}</span>
						{res.player.name} · {m.votes(res.votes)}
						{#if res.points > 0}<strong>{g.points(res.points)}</strong>{/if}
					</p>
				</div>
			{/each}
			{#if view.result.sweep}<p class="sweep">{m.sweep}</p>{/if}
			{#if canControl}<button class="btn pink" onclick={next}>{g.next}</button>{/if}
		{/if}
	{:else if view.phase === 'final'}
		<FinalScores
			leaderboard={view.leaderboard}
			youId={audience ? null : youId}
			{canControl}
			{onplayagain}
			{onendgame}
		/>
	{/if}
</section>

<style>
	.play {
		display: grid;
		gap: 16px;
	}
	.center {
		display: grid;
		gap: 14px;
		justify-items: center;
		padding: 24px 0;
		text-align: center;
	}
	.kicker {
		font-weight: 750;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.9rem;
	}
	.huge {
		font-size: clamp(2.4rem, 10vw, 3.5rem);
	}
	.prompt {
		font-size: clamp(1.5rem, 6vw, 2.1rem);
	}
	.waiting {
		padding: 18px;
		font-weight: 750;
		text-align: center;
	}
	.note {
		padding: 18px;
		background: var(--yellow);
		font-weight: 750;
		text-align: center;
	}
	.label {
		font-weight: 800;
		font-size: 1.2rem;
	}
	.options {
		display: grid;
		gap: 14px;
	}
	.option-btn {
		min-height: 96px;
		padding: 18px;
		border: var(--border);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		color: var(--ink);
		font: inherit;
		font-size: 1.3rem;
		font-weight: 800;
		text-align: left;
		overflow-wrap: anywhere;
		cursor: pointer;
		transition:
			transform 120ms ease-out,
			box-shadow 120ms ease-out,
			opacity 200ms ease-out;
	}
	.option-btn:disabled {
		cursor: default;
	}
	.option-btn:disabled:not(.picked) {
		opacity: 0.6;
	}
	.option-btn:active:not(:disabled) {
		transform: translate(3px, 3px);
		box-shadow: 1px 1px 0 var(--line);
	}
	.option-btn:focus-visible {
		transform: translate(-2px, -2px);
		box-shadow: var(--focus-shadow);
	}
	.picked {
		box-shadow:
			0 0 0 3px var(--bg),
			0 0 0 7px var(--ink);
	}
	.side-a {
		background: var(--pink);
	}
	.side-b {
		background: var(--teal);
	}
	.res {
		display: grid;
		gap: 8px;
		padding: 16px;
	}
	.res.mine {
		box-shadow:
			0 0 0 3px var(--bg),
			0 0 0 7px var(--ink);
	}
	.text {
		font-size: 1.3rem;
		font-weight: 800;
		overflow-wrap: anywhere;
	}
	.by {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		font-weight: 650;
	}
	.sweep {
		justify-self: center;
		padding: 6px 18px;
		border: var(--border);
		border-radius: 999px;
		background: var(--yellow);
		font-weight: 800;
	}
</style>
