<script lang="ts">
	interface Props {
		/** Deadline in server time (ms). */
		endsAt: number;
		durationMs: number;
		/** Server clock minus local clock. */
		clockOffset?: number;
		large?: boolean;
	}
	let { endsAt, durationMs, clockOffset = 0, large = false }: Props = $props();

	let now = $state(Date.now());

	$effect(() => {
		let frame = requestAnimationFrame(function loop() {
			now = Date.now();
			frame = requestAnimationFrame(loop);
		});
		return () => cancelAnimationFrame(frame);
	});

	const left = $derived(Math.max(0, endsAt - (now + clockOffset)));
	const seconds = $derived(Math.ceil(left / 1000));
	const fraction = $derived(durationMs > 0 ? left / durationMs : 0);
</script>

<div
	class="timer"
	class:large
	class:urgent={seconds <= 5 && left > 0}
	role="timer"
	aria-label="{seconds} seconds left"
>
	<span class="num" aria-hidden="true">{seconds}</span>
	<div class="bar" aria-hidden="true"><span style:scale="{fraction} 1"></span></div>
</div>

<style>
	.timer {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		gap: 12px;
		width: 100%;
	}
	.num {
		display: grid;
		place-items: center;
		min-width: 2.4em;
		height: 2.4em;
		border: var(--border);
		border-radius: 50%;
		background: var(--surface);
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}
	.large .num {
		font-size: 1.8rem;
	}
	.bar {
		height: 14px;
		border: var(--border);
		border-radius: 999px;
		background: var(--surface);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--teal);
		transform-origin: left;
	}
	.urgent .bar span {
		background: var(--pink);
	}
	.urgent .num {
		background: var(--pink);
	}
</style>
