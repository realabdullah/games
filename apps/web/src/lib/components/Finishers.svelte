<script lang="ts">
	/** Who got it this round, fastest first, for the big screen. */
	let {
		players,
		empty,
		first
	}: { players: { id: string; name: string; avatar: string }[]; empty: string; first: string } =
		$props();
</script>

<ol class="finishers card" aria-live="polite">
	{#each players as p, i (p.id)}
		<li>
			<span aria-hidden="true">{p.avatar}</span>
			<strong>{p.name}</strong>
			{#if i === 0}<span class="first">{first}</span>{/if}
		</li>
	{:else}
		<li class="empty">{empty}</li>
	{/each}
</ol>

<style>
	.finishers {
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 14px 16px;
		list-style: none;
		font-size: clamp(1rem, 1.6vw, 1.3rem);
	}
	li {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.empty {
		color: var(--ink-soft);
	}
	.first {
		margin-left: auto;
		padding: 2px 10px;
		border-radius: 999px;
		background: var(--yellow);
		font-weight: 800;
		font-size: 0.85em;
	}
</style>
