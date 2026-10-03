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
		background: var(--yellow);
		font-weight: 750;
		text-align: center;
	}
</style>
