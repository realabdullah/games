<script lang="ts">
	import { goto } from '$app/navigation';
	import type { AiStatusResponse } from '@games/protocol';
	import { api } from '$lib/api';
	import PackEditor from '$lib/components/PackEditor.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { t } from '$lib/i18n';
	import { myPacks } from '$lib/my-packs.svelte';

	const m = t.packs;

	let ai = $state<AiStatusResponse | null>(null);
	$effect(() => {
		api.aiStatus().then(
			(s) => (ai = s),
			() => (ai = { enabled: false, remaining: 0 })
		);
	});

	let topic = $state('');
	let count = $state<5 | 10 | 15>(10);
	let difficulty = $state<'easy' | 'medium' | 'hard'>('medium');
	let generating = $state(false);
	let aiError = $state<string | null>(null);

	async function generate(e: SubmitEvent) {
		e.preventDefault();
		generating = true;
		aiError = null;
		try {
			const res = await api.generatePack({ topic, count, difficulty });
			myPacks.remember(res.summary, res.editToken);
			await goto(`/packs/${res.summary.code}#${res.editToken}`);
		} catch (err) {
			aiError = err instanceof Error ? err.message : 'Something went wrong';
			api
				.aiStatus()
				.then((s) => (ai = s))
				.catch(() => {});
		} finally {
			generating = false;
		}
	}

	async function create(pack: Parameters<typeof api.createPack>[0]['pack']) {
		const res = await api.createPack({ game: 'trivia', pack });
		myPacks.remember(res.summary, res.editToken);
		await goto(`/packs/${res.summary.code}#${res.editToken}`);
	}
</script>

<Seo title="{m.newTitle} · {t.appName}" description={m.newDescription} path="/packs/new" />

<main>
	<a href="/packs" class="back">← {m.title}</a>
	<h1>{m.newTitle}</h1>

	{#if ai?.enabled}
		<form class="card ai" onsubmit={generate}>
			<h2>✨ {m.ai.title}</h2>
			<label class="field">
				{m.ai.topic}
				<input
					class="input"
					bind:value={topic}
					placeholder={m.ai.topicPlaceholder}
					minlength="3"
					maxlength="100"
					required
				/>
			</label>
			<div class="row">
				<label class="field">
					{m.ai.count}
					<select class="input" bind:value={count}>
						{#each [5, 10, 15] as n (n)}<option value={n}>{n}</option>{/each}
					</select>
				</label>
				<label class="field">
					{m.ai.difficulty}
					<select class="input" bind:value={difficulty}>
						<option value="easy">{m.ai.easy}</option>
						<option value="medium">{m.ai.medium}</option>
						<option value="hard">{m.ai.hard}</option>
					</select>
				</label>
			</div>
			{#if aiError}<p class="error" role="alert">{aiError}</p>{/if}
			<button
				class="btn teal"
				disabled={generating || ai.remaining === 0 || topic.trim().length < 3}
			>
				{generating ? m.ai.generating : m.ai.generate}
			</button>
			<p class="muted small">{m.ai.remaining(ai.remaining)} · {m.ai.review}</p>
		</form>
	{/if}

	<PackEditor saveLabel={m.create} onsave={create} />
</main>

<style>
	main {
		display: grid;
		gap: 20px;
		max-width: 680px;
		margin: 0 auto;
		padding: 32px var(--gutter) 0;
	}
	.back {
		font-weight: 700;
		text-decoration: none;
	}
	h1 {
		font-size: clamp(2.2rem, 7vw, 3rem);
	}
	.ai {
		display: grid;
		gap: 14px;
		padding: 18px;
		background: color-mix(in oklch, var(--teal) 30%, var(--surface));
	}
	h2 {
		font-size: 1.3rem;
	}
	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	.small {
		font-size: 0.9rem;
	}
</style>
