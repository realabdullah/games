<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$lib/api';
	import { catalog } from '$lib/catalog';
	import Motif from '$lib/components/Motif.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { t } from '$lib/i18n';
	import { DEFAULT_SEO } from '$lib/seo';
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

<Seo {...DEFAULT_SEO} path="/" />

<main>
	<header class="hero">
		<p class="brand">
			<svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
				<circle cx="14" cy="14" r="12" />
				<circle cx="14" cy="14" r="7" />
				<circle cx="14" cy="14" r="2" />
			</svg>
			<span class="eyebrow">{t.appName}</span>
		</p>
		<h1>{t.home.headline}</h1>
		<p class="tagline">{t.home.lede}</p>

		<div class="actions">
			<a class="btn primary join" href="/play">{t.home.join}<span aria-hidden="true">→</span></a>
			<button class="btn ghost" onclick={hostParty} disabled={creating}>{t.home.hostParty}</button>
			<a class="btn ghost" href="/online">{t.home.playOnline}</a>
		</div>
		<p class="muted hint">
			{t.home.hostPartyHint} <a href="/packs">{t.home.packs}</a>
		</p>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<div class="cloth" aria-hidden="true">
			{#each ['target', 'sun', 'stripes', 'diamonds', 'moon', 'grid', 'dots'] as id (id)}
				<Motif {id} />
			{/each}
		</div>
	</header>

	<section class="sheet surface" aria-labelledby="catalog-title">
		<h2 id="catalog-title">{t.home.catalogTitle}</h2>
		<ul class="list">
			{#each catalog as g (g.id)}
				<li class="game">
					<Motif id={g.motif} />
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
						{#if g.status === 'soon'}
							<span class="soon">Coming soon</span>
						{:else if g.modes.includes('solo')}
							<a class="btn ghost small solo" href="/solo/{g.id}">Play solo</a>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	</section>
</main>

<style>
	main {
		display: grid;
		gap: clamp(32px, 6vw, 56px);
		max-width: 1080px;
		margin: 0 auto;
		padding: clamp(32px, 7vw, 72px) var(--gutter) 0;
	}
	.hero {
		position: relative;
		display: grid;
		gap: 16px;
		justify-items: start;
	}
	/* Wide screens: a scatter of motifs fills the space beside the hero. */
	.cloth {
		display: none;
	}
	@media (min-width: 960px) {
		.cloth {
			position: absolute;
			top: 0;
			right: 0;
			display: grid;
			grid-template-columns: repeat(3, 120px);
			gap: 18px;
			font-size: 120px;
			rotate: -8deg;
		}
		.cloth > :global(:nth-child(2n)) {
			translate: 0 60px;
		}
		.cloth > :global(:nth-child(4)) {
			font-size: 0.7em;
			justify-self: center;
			align-self: center;
		}
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.brand svg {
		stroke: var(--gold);
		stroke-width: 2;
	}
	.brand circle:last-child {
		fill: var(--gold);
	}
	h1 {
		max-width: 14ch;
		font-size: clamp(2.6rem, 9vw, 5.25rem);
		line-height: 1.02;
	}
	.tagline {
		max-width: 36ch;
		font-size: clamp(1.1rem, 2.6vw, 1.35rem);
		color: var(--ink-soft);
	}
	.actions {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
		width: min(100%, 520px);
		margin-top: 8px;
	}
	.join {
		grid-column: 1 / -1;
		justify-content: space-between;
		min-height: 58px;
	}
	.join span {
		font-family: var(--display);
		font-size: 1.4rem;
	}
	.hint {
		font-size: 0.95rem;
	}
	.sheet {
		margin-inline: calc(var(--gutter) * -1);
		padding: 28px var(--gutter) 64px;
		border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
		background: var(--starch);
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
		margin-bottom: 8px;
		font-size: clamp(1.7rem, 4.5vw, 2.3rem);
	}
	.list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr));
		column-gap: 40px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.game {
		position: relative;
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: start;
		gap: 16px;
		padding: 16px 0;
		border-bottom: var(--stitch);
	}
	.game > :global(.motif) {
		font-size: 3.5rem;
	}
	.body {
		display: grid;
		gap: 2px;
		min-width: 0;
	}
	h3 {
		font-size: 1.15rem;
	}
	.body .muted {
		font-size: 0.95rem;
	}
	.meta {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--madder);
	}
	.solo {
		justify-self: start;
		margin-top: 8px;
	}
	.soon {
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--ink-soft);
	}
</style>
