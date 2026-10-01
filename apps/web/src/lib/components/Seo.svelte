<script lang="ts">
	import { seoTags, type Seo } from '$lib/seo';

	let props: Seo = $props();
	const tags = $derived(seoTags(props));
</script>

<svelte:head>
	<title>{tags.title}</title>
	{#if tags.canonical}
		<link rel="canonical" href={tags.canonical} />
	{/if}
	{#each tags.meta as tag ('name' in tag ? tag.name : tag.property)}
		{#if 'name' in tag}
			<meta name={tag.name} content={tag.content} />
		{:else}
			<meta property={tag.property} content={tag.content} />
		{/if}
	{/each}
</svelte:head>
