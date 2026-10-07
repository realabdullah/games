<script lang="ts">
	import type { AiStatusResponse, CreatedPackResponse } from '@games/protocol';
	import { api } from '$lib/api';
	import { t } from '$lib/i18n';

	interface Props {
		status: AiStatusResponse;
		ongenerated: (res: CreatedPackResponse) => Promise<void> | void;
	}
	let { status = $bindable(), ongenerated }: Props = $props();

	const m = t.packs.ai;

	let topic = $state('');
	let count = $state<5 | 10 | 15>(10);
	let difficulty = $state<'easy' | 'medium' | 'hard'>('medium');
	let generating = $state(false);
	let error = $state<string | null>(null);

	async function generate(e: SubmitEvent) {
		e.preventDefault();
		generating = true;
		error = null;
		try {
			await ongenerated(await api.generatePack({ topic, count, difficulty }));
		} catch (err) {
			error = err instanceof Error ? err.message : 'Something went wrong';
		} finally {
			generating = false;
			api
				.aiStatus()
				.then((s) => (status = s))
				.catch(() => {});
		}
	}
</script>

<form class="card ai" onsubmit={generate}>
	<h2>{m.title}</h2>
	<label class="field">
		{m.topic}
		<input
			class="input"
			bind:value={topic}
			placeholder={m.topicPlaceholder}
			minlength="3"
			maxlength="100"
			required
		/>
	</label>
	<div class="row">
		<label class="field">
			{m.count}
			<select class="input" bind:value={count}>
				{#each [5, 10, 15] as n (n)}<option value={n}>{n}</option>{/each}
			</select>
		</label>
		<label class="field">
			{m.difficulty}
			<select class="input" bind:value={difficulty}>
				<option value="easy">{m.easy}</option>
				<option value="medium">{m.medium}</option>
				<option value="hard">{m.hard}</option>
			</select>
		</label>
	</div>
	{#if error}<p class="error" role="alert">{error}</p>{/if}
	<button
		class="btn ghost"
		disabled={generating || status.remaining === 0 || topic.trim().length < 3}
		aria-busy={generating}
	>
		{generating ? m.generating : m.generate}
	</button>
	<p class="muted small">{m.remaining(status.remaining)} · {m.review}</p>
</form>

<style>
	.ai {
		display: grid;
		gap: 14px;
		padding: 18px;
		background: color-mix(in oklch, var(--leaf) 30%, var(--surface));
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
