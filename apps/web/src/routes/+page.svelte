<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$lib/api';
	import { catalog } from '$lib/catalog';
	import { t } from '$lib/i18n';
	import { saveSession } from '$lib/sessions';

	let creating = $state(false);
	let error = $state<string | null>(null);

	async function hostParty() {
		creating = true;
		error = null;
		try {
			const res = await api.createRoom({ mode: 'party' });
			saveSession('host', res.code, res.session);
			await goto(`/host/${res.code}`);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Something went wrong';
		} finally {
			creating = false;
		}
	}

	const modeLabel = { party: 'Big screen', online: 'Online', solo: 'Solo' };
</script>

<svelte:head>
	<title>{t.appName}: party games for any group</title>
	<meta name="description" content={t.tagline} />
</svelte:head>

<main>
	<header class="hero">
		<h1>{t.appName}</h1>
		<p class="tagline">{t.tagline}</p>

		<div class="actions">
			<a class="btn pink join" href="/play">{t.home.join}</a>
			<button class="btn" onclick={hostParty} disabled={creating}>{t.home.hostParty}</button>
			<a class="btn teal" href="/online">{t.home.playOnline}</a>
		</div>
		<p class="muted hint">{t.home.hostPartyHint}</p>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
	</header>

	<section aria-labelledby="catalog-title">
		<h2 id="catalog-title">{t.home.catalogTitle}</h2>
		<ul class="grid">
			{#each catalog as g (g.id)}
				<li class="card game" style:--accent={g.color}>
					<div class="art" aria-hidden="true">{g.emoji}</div>
					<div class="body">
						<h3>{g.name}</h3>
						<p class="muted">{g.tagline}</p>
						<p class="meta">
							{g.players.min === g.players.max
								? `${g.players.min}`
								: `${g.players.min}–${g.players.max}`} players · {g.modes
								.map((m) => modeLabel[m])
								.join(' · ')}
						</p>
					</div>
					{#if g.status === 'soon'}<span class="soon">Coming soon</span>{/if}
				</li>
			{/each}
		</ul>
	</section>
</main>

<style>
	main {
		display: grid;
		gap: clamp(40px, 8vw, 72px);
		max-width: 1080px;
		margin: 0 auto;
		padding: clamp(32px, 7vw, 72px) var(--gutter) 64px;
	}
	.hero {
		display: grid;
		gap: 18px;
		justify-items: start;
	}
	h1 {
		font-size: clamp(3rem, 12vw, 6.5rem);
		font-weight: 800;
		letter-spacing: -0.04em;
	}
	.tagline {
		max-width: 36ch;
		font-size: clamp(1.15rem, 3vw, 1.45rem);
		font-weight: 550;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-top: 8px;
	}
	.hint {
		font-size: 0.95rem;
	}
	h2 {
		margin-bottom: 20px;
		font-size: clamp(1.8rem, 5vw, 2.6rem);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr));
		gap: 20px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.game {
		position: relative;
		overflow: hidden;
	}
	.art {
		display: grid;
		place-items: center;
		aspect-ratio: 16 / 9;
		border-bottom: var(--border);
		background: var(--accent);
		font-size: 4rem;
	}
	.body {
		display: grid;
		gap: 6px;
		padding: 16px 18px 18px;
	}
	h3 {
		font-size: 1.4rem;
	}
	.meta {
		font-size: 0.9rem;
		font-weight: 700;
	}
	.soon {
		position: absolute;
		top: 12px;
		right: 12px;
		padding: 2px 10px;
		border: 2px solid var(--line);
		border-radius: 999px;
		background: var(--surface);
		font-size: 0.8rem;
		font-weight: 750;
	}
	@media (max-width: 520px) {
		.actions {
			display: grid;
			width: 100%;
		}
	}
</style>
