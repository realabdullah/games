<script lang="ts">
	import { AVATARS } from '@games/protocol';
	import Motif from '$lib/components/Motif.svelte';
	import { t } from '$lib/i18n';
	import { loadProfile, saveProfile, type Profile } from '$lib/sessions';

	interface Props {
		submitLabel: string;
		submittingLabel: string;
		onsubmit: (profile: Profile) => Promise<void>;
	}
	let { submitLabel, submittingLabel, onsubmit }: Props = $props();

	const initial = loadProfile();
	let name = $state(initial.name);
	let avatar = $state(initial.avatar);
	let busy = $state(false);
	let error = $state<string | null>(null);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		busy = true;
		const profile = { name: name.trim(), avatar };
		try {
			saveProfile(profile);
			await onsubmit(profile);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Something went wrong';
		} finally {
			busy = false;
		}
	}
</script>

<form onsubmit={submit} class="form">
	<label class="field">
		{t.join.nameLabel}
		<input
			class="input"
			bind:value={name}
			maxlength="16"
			required
			autocomplete="nickname"
			enterkeyhint="go"
		/>
	</label>

	<fieldset class="avatars">
		<legend class="field">{t.join.avatarLabel}</legend>
		{#each AVATARS as a (a)}
			<label class="avatar option" class:selected={a === avatar}>
				<input
					type="radio"
					name="avatar"
					value={a}
					bind:group={avatar}
					class="sr-only"
					aria-label={t.join.motif(a)}
				/>
				<Motif id={a} />
			</label>
		{/each}
	</fieldset>

	{#if error}<p class="error" role="alert">{error}</p>{/if}

	<button class="btn primary" type="submit" disabled={busy || !name.trim()}>
		{busy ? submittingLabel : submitLabel}
	</button>
</form>

<style>
	.form {
		display: grid;
		gap: 20px;
	}
	.avatars {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 8px;
		margin: 0;
		padding: 0;
		border: 0;
	}
	@media (min-width: 480px) {
		.avatars {
			grid-template-columns: repeat(8, 1fr);
		}
		.avatar {
			font-size: 3.1rem;
		}
	}
	.avatars legend {
		margin-bottom: 6px;
		padding: 0;
	}
	.avatar {
		display: grid;
		place-items: center;
		aspect-ratio: 1;
		border-radius: 50%;
		font-size: clamp(2.75rem, 17vw, 4.25rem);
		cursor: pointer;
		transition: transform 140ms ease-out;
	}
	.avatar.selected {
		outline: 2.5px dashed var(--gold);
		outline-offset: 4px;
		transform: scale(0.92);
	}
	.btn {
		justify-self: stretch;
	}
</style>
