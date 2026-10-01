<script lang="ts">
	import type { IcebreakersView } from '@games/icebreakers';
	import FinalScores from '$lib/components/FinalScores.svelte';
	import Leaderboard from '$lib/components/Leaderboard.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import type { HostViewProps } from '$lib/games/types';
	import { t } from '$lib/i18n';

	let { view: raw, clockOffset, onaction, onplayagain, onendgame }: HostViewProps = $props();
	const view = $derived(raw as IcebreakersView);
	const m = t.icebreakers;
	const g = t.games;
	const next = () => onaction({ type: 'next' });
</script>

<section class="host">
	{#if view.phase === 'intro'}
		<div class="center">
			<p class="kicker">{g.roundOf(1, view.rounds)}</p>
			<h2 class="title">{t.icebreakers.whoSaidIt}</h2>
			<p class="big">{m.howTo}</p>
			<div class="timer">
				<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} large />
			</div>
			<button class="btn" onclick={next}>{g.startNow}</button>
		</div>
	{:else if view.phase === 'write'}
		<header class="top">
			<p class="kicker">{g.roundOf(view.round + 1, view.rounds)}</p>
			<p class="count" aria-live="polite">{g.done(view.doneCount, view.expectedCount)}</p>
		</header>
		<h2 class="prompt">{view.prompt}</h2>
		<p class="big muted">{m.writeOnPhone}</p>
		<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} large />
		<footer><button class="btn ghost small" onclick={next}>{g.skip}</button></footer>
	{:else if (view.phase === 'guess' || view.phase === 'reveal') && view.current}
		<header class="top">
			<p class="kicker">{view.prompt}</p>
			<p class="count">{m.answerOf(view.current.number, view.current.total)}</p>
		</header>
		<blockquote class="answer card">“{view.current.text}”</blockquote>

		{#if view.phase === 'guess'}
			<p class="big">{m.whoSaidIt}</p>
			<Timer endsAt={view.endsAt} durationMs={view.durationMs} {clockOffset} large />
			<p class="count" aria-live="polite">{g.done(view.doneCount, view.expectedCount)}</p>
			<footer><button class="btn ghost small" onclick={next}>{g.skip}</button></footer>
		{:else if view.reveal}
			{@const r = view.reveal}
			{@const names = r.correct
				.map((id) => view.players.find((p) => p.id === id)?.name)
				.filter(Boolean)}
			<div class="reveal">
				<div class="author card">
					<span class="avatar" aria-hidden="true">{r.author.avatar}</span>
					<span>
						<span class="muted">{m.itWas}</span>
						<strong class="name">{r.author.name}</strong>
					</span>
				</div>
				<div class="notes">
					<p class="big">{names.length ? m.gotIt(names.join(', ')) : m.nobodyGotIt}</p>
					{#if r.fooled > 0}<p class="muted">{r.author.name}: {m.fooled(r.fooled)}</p>{/if}
				</div>
				<Leaderboard entries={view.leaderboard} limit={5} large />
			</div>
			<footer><button class="btn pink" onclick={next}>{g.next}</button></footer>
		{/if}
	{:else if view.phase === 'final'}
		<FinalScores leaderboard={view.leaderboard} canControl large {onplayagain} {onendgame} />
	{/if}
</section>

<style>
	.host {
		display: grid;
		gap: clamp(16px, 2.5vw, 28px);
	}
	.center {
		display: grid;
		gap: 16px;
		justify-items: center;
		padding: 4vh 0;
		text-align: center;
	}
	.timer {
		width: min(100%, 600px);
	}
	.kicker {
		font-weight: 750;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: clamp(1rem, 1.6vw, 1.3rem);
	}
	.title {
		font-size: clamp(3rem, 8vw, 6rem);
	}
	.big {
		font-size: clamp(1.4rem, 2.6vw, 2.2rem);
		font-weight: 750;
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 16px;
	}
	.count {
		font-size: clamp(1.1rem, 2vw, 1.6rem);
		font-weight: 750;
	}
	.prompt {
		font-size: clamp(2.2rem, 5vw, 4rem);
	}
	.answer {
		margin: 0;
		padding: clamp(24px, 4vw, 48px);
		background: var(--yellow);
		box-shadow: var(--shadow-lg);
		font-size: clamp(2rem, 4.5vw, 3.6rem);
		font-weight: 800;
		line-height: 1.15;
		overflow-wrap: anywhere;
	}
	.reveal {
		display: grid;
		gap: 24px;
	}
	@media (min-width: 900px) {
		.reveal {
			grid-template-columns: 1fr 1fr;
			grid-template-areas:
				'author board'
				'notes board';
			align-items: start;
		}
		.author {
			grid-area: author;
		}
		.notes {
			grid-area: notes;
		}
		.reveal :global(.board) {
			grid-area: board;
		}
	}
	.author {
		display: flex;
		align-items: center;
		gap: 20px;
		padding: 20px 28px;
		background: var(--teal);
		animation: pop 400ms cubic-bezier(0.3, 1.5, 0.5, 1);
	}
	.author > span:last-child {
		display: grid;
	}
	.avatar {
		font-size: clamp(3.5rem, 7vw, 5.5rem);
		line-height: 1;
	}
	.name {
		font-size: clamp(2rem, 4vw, 3.2rem);
	}
	.notes {
		display: grid;
		align-content: start;
		gap: 8px;
	}
	footer {
		display: flex;
		justify-content: center;
	}
	@keyframes pop {
		from {
			transform: scale(0.85);
			opacity: 0;
		}
	}
</style>
