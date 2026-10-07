<script lang="ts">
	import { goto } from '$app/navigation';
	import type { AiStatusResponse, CreatedPackResponse } from '@games/protocol';
	import { api } from '$lib/api';
	import AiPackForm from '$lib/components/AiPackForm.svelte';
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

	async function open(res: CreatedPackResponse) {
		myPacks.remember(res.summary, res.editToken);
		await goto(`/packs/${res.summary.code}#${res.editToken}`);
	}

	async function create(pack: Parameters<typeof api.createPack>[0]['pack']) {
		await open(await api.createPack({ game: 'trivia', pack }));
	}
</script>

<Seo title="{m.newTitle} · {t.appName}" description={m.newDescription} path="/packs/new" />

<main>
	<a href="/packs" class="back">← {m.title}</a>
	<h1>{m.newTitle}</h1>

	{#if ai?.enabled}
		<AiPackForm bind:status={ai} ongenerated={open} />
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
	h1 {
		font-size: clamp(2.2rem, 7vw, 3rem);
	}
</style>
