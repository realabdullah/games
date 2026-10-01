<script lang="ts">
	import '../app.css';
	import { afterNavigate } from '$app/navigation';
	import favicon from '$lib/assets/favicon.svg';
	import { initAnalytics, trackPage } from '$lib/analytics';

	let { children } = $props();

	initAnalytics();
	// The first page is counted when the script loads; count client-side navigations here.
	afterNavigate(({ type, to }) => {
		if (type !== 'enter' && to) trackPage(to.url.pathname);
	});
</script>

<svelte:head>
	<link rel="icon" href="/favicon.ico" sizes="32x32" />
	<link rel="icon" href={favicon} type="image/svg+xml" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
</svelte:head>

{@render children()}
