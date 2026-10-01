<script lang="ts">
	import { TriviaPackDraft } from '@games/content';
	import { v } from '@games/protocol';
	import { t } from '$lib/i18n';
	import { untrack } from 'svelte';

	type Draft = v.InferOutput<typeof TriviaPackDraft>;

	interface Props {
		initial?: Draft;
		saveLabel: string;
		onsave: (draft: Draft) => Promise<void>;
	}
	let { initial, saveLabel, onsave }: Props = $props();

	const m = t.packs.editor;
	const blankQuestion = () => ({ q: '', choices: ['', '', '', ''], answer: 0, fact: '' });

	// Editable copy of the pack as it was when the editor opened; facts are ''
	// rather than undefined so inputs can bind to them.
	const start = untrack(() => initial);
	let title = $state(start?.title ?? '');
	let description = $state(start?.description ?? '');
	let emoji = $state(start?.emoji ?? '');
	let questions = $state(
		start?.questions.map((q) => ({ ...q, choices: [...q.choices], fact: q.fact ?? '' })) ?? [
			blankQuestion(),
			blankQuestion(),
			blankQuestion()
		]
	);
	let busy = $state(false);
	let error = $state<string | null>(null);
	let saved = $state(false);

	function addQuestion() {
		questions.push(blankQuestion());
	}

	function removeQuestion(i: number) {
		questions.splice(i, 1);
	}

	function removeChoice(q: (typeof questions)[number], i: number) {
		q.choices.splice(i, 1);
		if (q.answer >= q.choices.length) q.answer = 0;
		else if (q.answer > i) q.answer--;
	}

	function toDraft() {
		return {
			title,
			description,
			emoji: emoji.trim() || undefined,
			questions: questions.map((q) => ({
				q: q.q,
				// Empty choice slots are fine while editing; drop them on save.
				choices: q.choices.map((c) => c.trim()).filter(Boolean),
				answer: q.choices.slice(0, q.answer).filter((c) => c.trim()).length,
				fact: q.fact.trim() || undefined
			}))
		};
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		saved = false;
		const correctBlank = questions.findIndex((q) => !q.choices[q.answer]?.trim());
		if (correctBlank >= 0) {
			error = m.correctBlank(correctBlank + 1);
			return;
		}
		const result = v.safeParse(TriviaPackDraft, toDraft());
		if (!result.success) {
			const issue = result.issues[0];
			const qIndex = issue.path?.find((p) => p.key === 'questions') ? issue.path?.[1]?.key : null;
			error =
				typeof qIndex === 'number' ? `${m.question(qIndex + 1)}: ${issue.message}` : issue.message;
			return;
		}
		busy = true;
		try {
			await onsave(result.output);
			saved = true;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Something went wrong';
		} finally {
			busy = false;
		}
	}
</script>

<form class="editor" onsubmit={submit}>
	<div class="meta card">
		<div class="row">
			<label class="field emoji">
				{m.emoji}
				<input class="input" bind:value={emoji} maxlength="4" placeholder="🧠" />
			</label>
			<label class="field grow">
				{m.title}
				<input class="input" bind:value={title} maxlength="60" required />
			</label>
		</div>
		<label class="field">
			{m.description}
			<input class="input small" bind:value={description} maxlength="160" />
		</label>
	</div>

	<ol class="questions">
		{#each questions as q, qi (qi)}
			<li class="question card">
				<div class="q-head">
					<span class="num">{m.question(qi + 1)}</span>
					{#if questions.length > 3}
						<button type="button" class="link" onclick={() => removeQuestion(qi)}>{m.remove}</button
						>
					{/if}
				</div>
				<label class="field">
					<span class="sr-only">{m.question(qi + 1)}</span>
					<input
						class="input"
						bind:value={q.q}
						maxlength="200"
						placeholder={m.questionPlaceholder}
					/>
				</label>
				<fieldset class="choices">
					<legend class="hint">{m.choicesHint}</legend>
					{#each q.choices as _, ci (ci)}
						<div class="choice" class:correct={q.answer === ci}>
							<input
								type="radio"
								name="answer-{qi}"
								value={ci}
								bind:group={q.answer}
								aria-label={m.markCorrect(ci + 1)}
							/>
							<input
								class="input small"
								bind:value={q.choices[ci]}
								maxlength="80"
								placeholder={m.choice(ci + 1)}
								aria-label={m.choice(ci + 1)}
							/>
							{#if q.choices.length > 2}
								<button
									type="button"
									class="x"
									onclick={() => removeChoice(q, ci)}
									aria-label={m.removeChoice(ci + 1)}>×</button
								>
							{/if}
						</div>
					{/each}
					{#if q.choices.length < 4}
						<button type="button" class="link" onclick={() => q.choices.push('')}
							>{m.addChoice}</button
						>
					{/if}
				</fieldset>
				<label class="field">
					<span class="hint">{m.fact}</span>
					<input class="input small" bind:value={q.fact} maxlength="240" />
				</label>
			</li>
		{/each}
	</ol>

	<button type="button" class="btn ghost" onclick={addQuestion}>{m.addQuestion}</button>

	<div class="save">
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		{#if saved}<p class="ok" role="status">{m.saved}</p>{/if}
		<button class="btn pink" disabled={busy}>{busy ? m.saving : saveLabel}</button>
	</div>
</form>

<style>
	.editor {
		display: grid;
		gap: 18px;
	}
	.meta,
	.question {
		display: grid;
		gap: 12px;
		padding: 16px;
		box-shadow: 3px 3px 0 var(--line);
	}
	.row {
		display: grid;
		grid-template-columns: 80px 1fr;
		gap: 12px;
	}
	.emoji .input {
		text-align: center;
	}
	.input.small {
		min-height: 46px;
		font-size: 1.05rem;
		font-weight: 550;
	}
	.questions {
		display: grid;
		gap: 16px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.q-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.num {
		font-weight: 800;
	}
	.choices {
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 0;
		border: 0;
	}
	.hint {
		padding: 0;
		font-size: 0.9rem;
		font-weight: 650;
		color: var(--ink-soft);
	}
	.choice {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 10px;
		padding: 4px 8px;
		border-radius: var(--radius-sm);
	}
	.choice.correct {
		background: color-mix(in oklch, var(--teal) 45%, transparent);
	}
	.x {
		width: 36px;
		height: 36px;
		border: 2px solid var(--line);
		border-radius: 50%;
		background: var(--surface);
		font: inherit;
		font-weight: 800;
		cursor: pointer;
	}
	.link {
		justify-self: start;
		padding: 4px 0;
		border: 0;
		background: none;
		color: var(--ink);
		font: inherit;
		font-weight: 700;
		text-decoration: underline;
		cursor: pointer;
	}
	.save {
		position: sticky;
		bottom: 0;
		display: grid;
		gap: 8px;
		padding: 12px 0 16px;
		background: var(--bg);
	}
	.ok {
		font-weight: 700;
	}
</style>
