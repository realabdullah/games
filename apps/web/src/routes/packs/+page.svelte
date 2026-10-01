<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import { t } from '$lib/i18n';
	import { myPacks } from '$lib/my-packs.svelte';

	const m = t.packs;

	// Saved packs live in this browser, so the server can't render them; show them once hydrated.
	let mounted = $state(false);
	$effect(() => {
		mounted = true;
	});
</script>

<Seo title="{m.title} · {t.appName}" description={m.intro} path="/packs" />

<main>
	<a href="/" class="back">← {t.appName}</a>
	<h1>{m.title}</h1>
	<p class="muted">{m.intro}</p>
	<a class="btn pink" href="/packs/new">{m.newPack}</a>

	<section aria-labelledby="mine">
		<h2 id="mine">{m.mine}</h2>
		{#if !mounted}
			<!-- Filled in on the client. -->
		{:else if myPacks.list.length === 0}
			<p class="muted">{m.none}</p>
		{:else}
			<ul class="list">
				{#each myPacks.list as p (p.code)}
					<li>
						<a class="card pack" href="/packs/{p.code}">
							<span class="emoji" aria-hidden="true">{p.emoji ?? '🧠'}</span>
							<span class="body">
								<strong>{p.title}</strong>
								<span class="muted">{m.questions(p.count)} · {p.code}</span>
							</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</main>

<style>
	main {
		display: grid;
		gap: 20px;
		max-width: 640px;
		margin: 0 auto;
		padding: 32px var(--gutter) 64px;
	}
	.back {
		font-weight: 700;
		text-decoration: none;
	}
	h1 {
		font-size: clamp(2.2rem, 7vw, 3rem);
	}
	main > .btn {
		justify-self: start;
	}
	section {
		display: grid;
		gap: 12px;
		margin-top: 16px;
	}
	h2 {
		font-size: 1.5rem;
	}
	.list {
		display: grid;
		gap: 12px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.pack {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 18px;
		text-decoration: none;
		box-shadow: 3px 3px 0 var(--line);
	}
	.pack {
		transition:
			transform 120ms ease-out,
			box-shadow 120ms ease-out;
	}
	.pack:focus-visible {
		background: var(--surface);
		transform: translate(-2px, -2px);
		box-shadow: var(--focus-shadow);
	}
	.emoji {
		font-size: 2rem;
	}
	.body {
		display: grid;
	}
</style>
