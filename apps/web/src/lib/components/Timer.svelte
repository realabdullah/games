<script lang="ts">
	import { untrack } from 'svelte';

	interface Props {
		/** Deadline in server time (ms). */
		endsAt: number;
		durationMs: number;
		/** Server clock minus local clock. */
		clockOffset?: number;
		large?: boolean;
	}
	let { endsAt, durationMs, clockOffset = 0, large = false }: Props = $props();

	// The number only needs whole seconds, so tick four times a second and stop
	// at zero. The bar drains in CSS on the compositor, not per frame.
	let now = $state(Date.now());
	$effect(() => {
		const deadline = endsAt - clockOffset;
		now = Date.now();
		if (deadline <= now) return;
		const id = setInterval(() => {
			now = Date.now();
			if (now >= deadline) clearInterval(id);
		}, 250);
		return () => clearInterval(id);
	});

	const left = $derived(Math.max(0, endsAt - (now + clockOffset)));
	const seconds = $derived(Math.ceil(left / 1000));

	/** Where the bar starts and how long it drains, fixed per deadline. */
	const drain = $derived.by(() => {
		const ms = Math.max(0, endsAt - (untrack(() => clockOffset) + Date.now()));
		return { from: durationMs > 0 ? Math.min(1, ms / durationMs) : 0, ms };
	});
</script>

<div
	class="timer"
	class:large
	class:urgent={seconds <= 5 && left > 0}
	role="timer"
	aria-label="{seconds} seconds left"
>
	<span class="num" aria-hidden="true">{seconds}</span>
	<div class="bar" aria-hidden="true">
		{#key drain}
			<span style:--from={drain.from} style:--ms="{drain.ms}ms"></span>
		{/key}
	</div>
</div>

<style>
	.timer {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		gap: 14px;
		width: 100%;
	}
	.num {
		min-width: 1.25em;
		font-family: var(--display);
		font-size: 1.6rem;
		line-height: 1;
		text-align: right;
		font-variant-numeric: tabular-nums;
		transition: color 200ms ease-out;
	}
	.large {
		gap: 20px;
	}
	.large .num {
		font-size: 2.6rem;
	}
	.bar {
		height: 10px;
		border-radius: 5px;
		background: var(--dye-raised);
		overflow: hidden;
	}
	.large .bar {
		height: 14px;
		border-radius: 7px;
	}
	/* Stitched gold thread that drains to the left. */
	.bar span {
		display: block;
		height: 100%;
		background: repeating-linear-gradient(90deg, var(--gold) 0 12px, var(--starch) 12px 16px);
		transform-origin: left;
		scale: var(--from) 1;
		animation: drain var(--ms) linear forwards;
		transition: background-color 200ms;
	}
	.urgent .num {
		color: var(--clay);
	}
	.urgent .bar span {
		background: repeating-linear-gradient(90deg, var(--clay) 0 12px, var(--starch) 12px 16px);
	}
	@keyframes drain {
		from {
			scale: var(--from) 1;
		}
		to {
			scale: 0 1;
		}
	}
	/* The bar is information, not decoration: it keeps draining with reduced motion. */
	@media (prefers-reduced-motion: reduce) {
		.bar span {
			animation-duration: var(--ms) !important;
		}
	}
</style>
