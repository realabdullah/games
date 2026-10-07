<script lang="ts">
	import type { AiStatusResponse, CreatedPackResponse, EditPackResponse } from '@games/protocol';
	import { api } from '$lib/api';
	import { t } from '$lib/i18n';
	import { myPacks } from '$lib/my-packs.svelte';
	import AiPackForm from './AiPackForm.svelte';
	import PackEditor from './PackEditor.svelte';

	interface Props {
		/** Called with the new pack's code as soon as it exists, so the host can play it. */
		onpack: (code: string) => void;
	}
	let { onpack }: Props = $props();

	const p = t.picker;

	let status = $state<AiStatusResponse | null>(null);
	$effect(() => {
		api.aiStatus().then(
			(s) => (status = s),
			() => (status = null)
		);
	});

	let open = $state(false);
	/** The pack being reviewed, with what's needed to save changes to it. */
	let review = $state<{ code: string; token: string; pack: EditPackResponse['pack'] } | null>(null);

	async function generated({ summary, editToken }: CreatedPackResponse) {
		myPacks.remember(summary, editToken);
		onpack(summary.code);
		const { pack } = await api.getPackForEdit(summary.code, editToken);
		review = { code: summary.code, token: editToken, pack };
	}

	async function save(pack: EditPackResponse['pack']) {
		if (!review) return;
		const summary = await api.updatePack(review.code, review.token, { game: 'trivia', pack });
		myPacks.remember(summary, review.token);
	}

	function done() {
		review = null;
		open = false;
	}
</script>

{#if status?.enabled}
	{#if !open}
		<button type="button" class="btn ghost small" onclick={() => (open = true)}>{p.generate}</button
		>
	{:else if review}
		<section class="review" aria-live="polite">
			<p class="note">{p.generated}</p>
			{#key review.code}
				<PackEditor initial={review.pack} saveLabel={p.saveChanges} onsave={save} />
			{/key}
			<button type="button" class="btn ghost small" onclick={done}>{p.doneReviewing}</button>
		</section>
	{:else}
		<AiPackForm bind:status ongenerated={generated} />
	{/if}
{/if}

<style>
	.btn.small {
		justify-self: start;
	}
	.review {
		display: grid;
		gap: 14px;
	}
	.review > .btn {
		justify-self: start;
	}
	.note {
		font-weight: 700;
	}
</style>
