<script lang="ts">
	/**
	 * Dyes the page's cloth for the game on screen. Sets data-dye on <html>, so
	 * the background crossfades; leaving puts the cloth back to indigo.
	 */
	import { dyeFor } from '$lib/catalog';

	let { game }: { game: string | null | undefined } = $props();

	$effect(() => {
		document.documentElement.dataset.dye = dyeFor(game);
		return () => {
			delete document.documentElement.dataset.dye;
		};
	});
</script>
