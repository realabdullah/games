<script lang="ts">
	import { AVATARS } from '@games/protocol';
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
				<input type="radio" name="avatar" value={a} bind:group={avatar} class="sr-only" />
				<span aria-hidden="true">{a}</span>
			</label>
		{/each}
	</fieldset>

	{#if error}<p class="error" role="alert">{error}</p>{/if}

	<button class="btn pink" type="submit" disabled={busy || !name.trim()}>
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
	}
	.avatars legend {
		margin-bottom: 6px;
		padding: 0;
	}
	.avatar {
		display: grid;
		place-items: center;
		aspect-ratio: 1;
		border: var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		font-size: clamp(1.75rem, 8vw, 2.25rem);
		cursor: pointer;
		transition:
			transform 120ms ease-out,
			box-shadow 120ms ease-out;
	}
	.avatar.selected {
		background: var(--yellow);
		box-shadow: 3px 3px 0 var(--line);
		transform: translate(-2px, -2px);
	}
	.btn {
		justify-self: stretch;
	}
</style>
