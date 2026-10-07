<script lang="ts">
	import { goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import type { EditPackResponse, PackSummary } from '@games/protocol';
	import { api } from '$lib/api';
	import PackEditor from '$lib/components/PackEditor.svelte';
	import { t } from '$lib/i18n';
	import { editLink, myPacks } from '$lib/my-packs.svelte';

	const m = t.packs;
	const code = page.params.code!.toUpperCase();

	// The edit token comes from the link's #fragment, or from this browser's saved packs.
	const fromHash = typeof location !== 'undefined' ? location.hash.slice(1) : '';
	const token = fromHash || myPacks.get(code)?.editToken || '';

	let loaded = $state<EditPackResponse | null>(null);
	let summary = $state<PackSummary | null>(null);
	let error = $state<string | null>(null);
	let copied = $state(false);

	$effect(() => {
		if (!token) {
			api.packSummary(code).then(
				(s) => (summary = s),
				(err) => (error = err.message)
			);
			return;
		}
		api.getPackForEdit(code, token).then(
			(res) => {
				loaded = res;
				summary = res.summary;
				// Opening an edit link on a new device adds the pack to "your packs" there.
				myPacks.remember(res.summary, token);
				// Keep the token out of the address bar (and history) once it's saved.
				if (fromHash) replaceState(location.pathname, {});
			},
			(err) => (error = err.message)
		);
	});

	async function save(pack: EditPackResponse['pack']) {
		summary = await api.updatePack(code, token, { game: 'trivia', pack });
		myPacks.remember(summary, token);
	}

	async function remove() {
		if (!confirm(m.confirmDelete)) return;
		await api.deletePack(code, token);
		myPacks.forget(code);
		await goto('/packs');
	}

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(editLink(code, token));
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {}
	}
</script>

<svelte:head><title>{summary?.title ?? code} · {t.appName}</title></svelte:head>

<main>
	<a href="/packs" class="back">← {m.title}</a>

	{#if error}
		<p class="error" role="alert">{error}</p>
	{:else if summary}
		<header class="head">
			<span class="emoji" aria-hidden="true">{summary.emoji ?? '🧠'}</span>
			<div>
				<h1>{summary.title}</h1>
				<p class="muted">{m.questions(summary.count)}</p>
			</div>
		</header>

		<div class="cards">
			<div class="card share">
				<h2>{m.shareTitle}</h2>
				<p>{m.shareHow}</p>
				<p class="code">{summary.code}</p>
			</div>
			{#if loaded}
				<div class="card link">
					<h2>{m.editLinkTitle}</h2>
					<p class="muted">{m.editLinkHow}</p>
					<button class="btn small" onclick={copyLink}>{copied ? m.copied : m.copy}</button>
				</div>
			{/if}
		</div>

		{#if summary.flagged}<p class="warn">{m.flagged}</p>{/if}

		{#if loaded}
			<PackEditor initial={loaded.pack} saveLabel={m.save} onsave={save} />
			<button class="btn ghost small danger" onclick={remove}>{m.delete}</button>
		{:else}
			<p class="muted">{m.noToken}</p>
		{/if}
	{:else}
		<p class="muted">{t.status.connecting}</p>
	{/if}
</main>

<style>
	main {
		display: grid;
		gap: 20px;
		max-width: 680px;
		margin: 0 auto;
		padding: 32px var(--gutter) 48px;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 16px;
	}
	.head .emoji {
		font-size: 3rem;
	}
	h1 {
		font-size: clamp(2rem, 6vw, 2.6rem);
	}
	.cards {
		display: grid;
		gap: 16px;
	}
	@media (min-width: 600px) {
		.cards {
			grid-template-columns: 1fr 1fr;
		}
	}
	.card {
		display: grid;
		align-content: start;
		gap: 8px;
		padding: 16px;
	}
	.share {
		background: var(--gold);
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
		font-size: 1.15rem;
	}
	.code {
		font-size: 2.2rem;
		font-weight: 800;
		letter-spacing: 0.15em;
	}
	.link .btn {
		justify-self: start;
	}
	.warn {
		font-weight: 700;
	}
	.danger {
		justify-self: start;
		margin-bottom: 24px;
	}
</style>
