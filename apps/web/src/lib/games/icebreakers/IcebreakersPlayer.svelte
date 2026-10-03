<script lang="ts">
	import { MAX_ANSWER_LENGTH, type IcebreakersView } from '@games/icebreakers';
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
	const view = $derived(raw as IcebreakersView);
	const you = $derived(view.you);
	const m = t.icebreakers;
	const g = t.games;
	const next = () => onaction({ type: 'next' });
	const nameOf = (id: string | null) => view.players.find((p) => p.id === id)?.name ?? '';
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
		<p class="kicker">{g.roundOf(view.round + 1, view.rounds)}</p>
		<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} />
		<h2 class="prompt">{view.prompt}</h2>
		{#if !you || audience}
			<p class="muted">{g.done(view.doneCount, view.expectedCount)}</p>
		{:else if you.answered}
			<p class="mine card">“{you.myAnswer}”</p>
			<p class="waiting">{g.lockedIn}</p>
		{:else}
			<TextAnswer
				label={m.yourAnswer}
				maxLength={MAX_ANSWER_LENGTH}
				placeholder={m.placeholder}
				onsubmit={(text) => onaction({ type: 'answer', text })}
			/>
		{/if}
		{#if canControl}<button class="btn ghost small" onclick={next}>{g.skip}</button>{/if}
	{:else if (view.phase === 'guess' || view.phase === 'reveal') && view.current}
		<p class="kicker">{m.answerOf(view.current.number, view.current.total)}</p>
		<blockquote class="answer card">“{view.current.text}”</blockquote>

		{#if view.phase === 'guess'}
			<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} />
			{#if you?.isAuthor}
				<p class="note card">{m.yours}</p>
			{:else if you?.guess}
				<p class="waiting">{m.youGuessed(nameOf(you.guess))}</p>
			{:else if you}
				<p class="label">{m.whoSaidIt}</p>
				<div class="who">
					{#each view.players.filter((p) => p.id !== youId) as p (p.id)}
						<button class="person" onclick={() => onaction({ type: 'guess', playerId: p.id })}>
							<span class="avatar" aria-hidden="true">{p.avatar}</span>
							<span>{p.name}</span>
						</button>
					{/each}
				</div>
			{/if}
			{#if canControl}<button class="btn ghost small" onclick={next}>{g.skip}</button>{/if}
		{:else if view.reveal}
			{@const r = view.reveal}
			{@const right = !!you?.guess && you.guess === r.author.id}
			<div
				class="result card"
				class:good={right || you?.isAuthor}
				class:bad={!right && !you?.isAuthor}
			>
				<p class="muted">{m.itWas}</p>
				<p class="author"><span aria-hidden="true">{r.author.avatar}</span> {r.author.name}</p>
				{#if you?.isAuthor}
					<p>{m.fooled(r.fooled)}</p>
				{:else if you}
					<p class="big">{right ? m.correct : you.guess ? m.wrong : m.noGuess}</p>
				{/if}
				{#if you && !audience && you.points > 0}<p class="points">{g.points(you.points)}</p>{/if}
			</div>
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
	.mine,
	.answer {
		margin: 0;
		padding: 18px;
		font-size: 1.3rem;
		font-weight: 750;
		overflow-wrap: anywhere;
	}
	.answer {
		background: var(--yellow);
		font-size: clamp(1.4rem, 6vw, 1.9rem);
		line-height: 1.2;
	}
	.waiting {
		font-weight: 750;
		text-align: center;
	}
	.note {
		padding: 18px;
		background: var(--teal);
		font-weight: 750;
		text-align: center;
	}
	.label {
		font-weight: 800;
		font-size: 1.2rem;
	}
	.who {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 10px;
	}
	.person {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 60px;
		padding: 10px 14px;
		border: var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		box-shadow: 3px 3px 0 var(--line);
		color: var(--ink);
		font: inherit;
		font-weight: 750;
		text-align: left;
		cursor: pointer;
		transition:
			transform 120ms ease-out,
			box-shadow 120ms ease-out;
	}
	.person:active {
		transform: translate(2px, 2px);
		box-shadow: 1px 1px 0 var(--line);
	}
	.person:focus-visible {
		transform: translate(-2px, -2px);
		box-shadow: var(--focus-shadow);
	}
	.person .avatar {
		font-size: 1.8rem;
	}
	.result {
		display: grid;
		gap: 4px;
		justify-items: center;
		padding: 22px;
		text-align: center;
	}
	.good {
		background: var(--teal);
	}
	.bad {
		background: var(--pink);
	}
	.author {
		font-size: 1.8rem;
		font-weight: 800;
	}
	.big {
		font-size: 1.3rem;
		font-weight: 800;
	}
	.points {
		font-size: 2rem;
		font-weight: 800;
	}
</style>
