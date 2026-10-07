<script lang="ts">
	/**
	 * A player's avatar: an adire-style motif drawn with CSS gradients. Sized by
	 * font-size (1em across), so it drops in where an emoji avatar used to sit.
	 */
	let { id }: { id: string } = $props();
</script>

<span class="motif" data-motif={id} aria-hidden="true"></span>

<style>
	.motif {
		--i: #18224b;
		--d: #2a3a78;
		--s: #f1ebdd;
		--g: #e0a526;
		--m: #b8432f;
		display: inline-block;
		flex: none;
		width: 1em;
		height: 1em;
		border-radius: 50%;
		vertical-align: middle;
		box-shadow: 0 0 0 1.5px rgb(241 235 221 / 0.22);
		background-color: var(--i);
	}

	[data-motif='rings'] {
		background: repeating-radial-gradient(circle, var(--i) 0 0.09em, var(--g) 0.09em 0.14em);
	}
	[data-motif='stripes'] {
		background: repeating-linear-gradient(45deg, var(--i) 0 0.1em, var(--s) 0.1em 0.17em);
	}
	[data-motif='grid'] {
		background-color: var(--m);
		background-image:
			linear-gradient(var(--i) 0.04em, transparent 0.04em),
			linear-gradient(90deg, var(--i) 0.04em, transparent 0.04em);
		background-size: 0.2em 0.2em;
	}
	[data-motif='dots'] {
		background: radial-gradient(var(--s) 0.035em, var(--d) 0.045em) 0 0 / 0.16em 0.16em;
	}
	[data-motif='diamonds'] {
		background: conic-gradient(from 45deg, var(--g) 25%, var(--i) 0 50%, var(--g) 0 75%, var(--i) 0)
			0 0 / 0.22em 0.22em;
	}
	[data-motif='sun'] {
		background: repeating-conic-gradient(var(--m) 0 15deg, var(--s) 0 30deg);
	}
	[data-motif='scales'] {
		background-color: var(--d);
		background-image: radial-gradient(
			circle at 50% 100%,
			var(--g) 0.09em,
			var(--i) 0.1em,
			var(--i) 0.12em,
			transparent 0.125em
		);
		background-size: 0.25em 0.14em;
	}
	[data-motif='checks'] {
		background: conic-gradient(var(--s) 25%, var(--i) 0 50%, var(--s) 0 75%, var(--i) 0) 0 0 /
			0.25em 0.25em;
	}
	[data-motif='bands'] {
		background: repeating-linear-gradient(
			0deg,
			var(--i) 0 0.12em,
			var(--g) 0.12em 0.19em,
			var(--i) 0.19em 0.26em,
			var(--m) 0.26em 0.33em
		);
	}
	[data-motif='crosses'] {
		background-color: var(--s);
		background-image:
			linear-gradient(90deg, transparent 0.065em, var(--m) 0.065em 0.135em, transparent 0.135em),
			linear-gradient(transparent 0.065em, var(--m) 0.065em 0.135em, transparent 0.135em);
		background-size: 0.2em 0.2em;
		background-position: 0 0;
	}
	[data-motif='moon'] {
		background:
			radial-gradient(circle at 62% 40%, var(--i) 0.24em, transparent 0.245em),
			radial-gradient(circle at 50% 50%, var(--g) 0.32em, var(--i) 0.325em);
	}
	[data-motif='target'] {
		background: radial-gradient(
			circle,
			var(--m) 0 0.12em,
			var(--s) 0.12em 0.22em,
			var(--i) 0.22em 0.32em,
			var(--g) 0.32em 0.4em,
			var(--i) 0.4em
		);
	}
	[data-motif='ladder'] {
		background-color: var(--i);
		background-image:
			linear-gradient(90deg, var(--s) 0.04em, transparent 0.04em),
			linear-gradient(var(--g) 0.035em, transparent 0.035em);
		background-size:
			0.24em 100%,
			100% 0.12em;
	}
	[data-motif='quarters'] {
		background: conic-gradient(var(--g) 0 25%, var(--i) 0 50%, var(--m) 0 75%, var(--s) 0);
	}
	[data-motif='zigzag'] {
		background-color: var(--i);
		background-image:
			linear-gradient(135deg, var(--g) 25%, transparent 25%),
			linear-gradient(225deg, var(--g) 25%, transparent 25%);
		background-size: 0.22em 0.22em;
	}
	[data-motif='seeds'] {
		background:
			radial-gradient(ellipse 0.035em 0.07em, var(--g) 90%, transparent) 0 0 / 0.16em 0.2em,
			var(--d);
	}
	[data-motif='bot'] {
		background: radial-gradient(var(--i) 0.03em, #8f97bf 0.04em) 0 0 / 0.12em 0.12em;
	}
</style>
