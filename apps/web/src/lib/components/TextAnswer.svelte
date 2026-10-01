<script lang="ts">
	import { t } from '$lib/i18n';

	/** A short free-text answer with a character count. Clears itself after sending. */
	interface Props {
		label: string;
		maxLength: number;
		placeholder?: string;
		submitLabel?: string;
		onsubmit: (text: string) => void;
	}
	let {
		label,
		maxLength,
		placeholder = '',
		submitLabel = t.games.send,
		onsubmit
	}: Props = $props();
	const uid = $props.id();

	let text = $state('');
	const left = $derived(maxLength - text.length);

	function submit(e: SubmitEvent) {
		e.preventDefault();
		const value = text.trim();
		if (!value) return;
		onsubmit(value);
		text = '';
	}
</script>

<form class="answer" onsubmit={submit}>
	<label for={uid} class="sr-only">{label}</label>
	<textarea
		id={uid}
		class="input"
		bind:value={text}
		maxlength={maxLength}
		{placeholder}
		rows="3"
		enterkeyhint="send"
		onkeydown={(e) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				e.currentTarget.form?.requestSubmit();
			}
		}}></textarea>
	<div class="row">
		<span class="count" class:low={left <= 10} aria-live="polite">{left}</span>
		<button class="btn pink" disabled={!text.trim()}>{submitLabel}</button>
	</div>
</form>

<style>
	.answer {
		display: grid;
		gap: 10px;
	}
	textarea {
		resize: none;
		min-height: 110px;
		line-height: 1.35;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.count {
		font-weight: 700;
		color: var(--ink-soft);
		font-variant-numeric: tabular-nums;
	}
	.low {
		color: var(--danger);
	}
</style>
