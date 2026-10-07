<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$lib/api';
	import ProfileForm from '$lib/components/ProfileForm.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { t } from '$lib/i18n';
	import { saveSession, type Profile } from '$lib/sessions';

	async function create(profile: Profile) {
		const res = await api.createRoom({ mode: 'online', ...profile });
		saveSession('play', res.code, res.session);
		await goto(`/play/${res.code}`);
	}
</script>

<Seo title="{t.online.title} · {t.appName}" description={t.online.description} path="/online" />

<main>
	<a href="/" class="back">← {t.appName}</a>
	<h1>{t.online.title}</h1>
	<p class="muted">{t.home.playOnlineHint}</p>
	<ProfileForm
		submitLabel={t.online.submit}
		submittingLabel={t.online.submitting}
		onsubmit={create}
	/>
</main>

<style>
	main {
		display: grid;
		gap: 20px;
		max-width: 520px;
		margin: 0 auto;
		padding: 32px var(--gutter);
	}
	h1 {
		font-size: 2.6rem;
	}
</style>
