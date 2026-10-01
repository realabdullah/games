<script lang="ts">
	import { goto } from '$app/navigation';
	import { ROOM_CODE_LENGTH } from '@games/protocol';
	import { api } from '$lib/api';
	import { t } from '$lib/i18n';

	let code = $state('');
	let busy = $state(false);
	let error = $state<string | null>(null);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		const c = code.trim().toUpperCase();
		busy = true;
		error = null;
		try {
			await api.roomInfo(c);
			await goto(`/play/${c}`);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Something went wrong';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>{t.join.title} · {t.appName}</title></svelte:head>

<main>
	<a href="/" class="back">← {t.appName}</a>
	<h1>{t.join.title}</h1>
	<form onsubmit={submit}>
		<label class="field">
			{t.join.codeLabel}
			<input
				class="input code"
				bind:value={code}
				maxlength={ROOM_CODE_LENGTH}
				autocomplete="off"
				autocapitalize="characters"
				spellcheck="false"
				enterkeyhint="go"
				required
			/>
		</label>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<button class="btn pink" disabled={busy || code.trim().length !== ROOM_CODE_LENGTH}>
			{busy ? t.join.submitting : t.join.submit}
		</button>
	</form>
</main>

<style>
	main {
		display: grid;
		gap: 24px;
		max-width: 440px;
		margin: 0 auto;
		padding: 32px var(--gutter);
	}
	.back {
		font-weight: 700;
		text-decoration: none;
	}
	h1 {
		font-size: 2.6rem;
	}
	form {
		display: grid;
		gap: 16px;
	}
</style>
