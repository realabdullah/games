<script lang="ts">
	import { t } from '$lib/i18n';

	/**
	 * For a player who is in the room but not in the game running now: they
	 * joined after it started, and this game can't take newcomers. Say so
	 * plainly, so nobody mistakes it for buttons that don't work.
	 */
</script>

<p class="sitting-out card" role="status">{t.games.sittingOut}</p>

<style>
	.sitting-out {
		padding: 14px 16px;
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
		font-weight: 750;
		text-align: center;
	}
</style>
