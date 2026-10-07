<script lang="ts">
	import { COLORS, WIDTHS, type StreamEvent, type Stroke } from '@games/doodle';
	import type { GameStream } from '$lib/games/types';
	import { t } from '$lib/i18n';

	/**
	 * The shared drawing surface. The drawer's strokes are drawn locally and
	 * sent in ~50ms batches; everyone else redraws from the stream. Points are
	 * normalized 0..1 so every screen size sees the same picture.
	 */
	interface Props {
		turn: number;
		stream: GameStream;
		canDraw: boolean;
		youId: string | null;
	}
	let { turn, stream, canDraw, youId }: Props = $props();
	const m = t.doodle;

	let canvas: HTMLCanvasElement;
	let strokes: Stroke[] = [];
	let color = $state(0);
	let width = $state(1);
	let frame = 0;

	// New turn: start blank, or catch up from the snapshot if it's for this turn.
	$effect(() => {
		const snap = stream.snapshot as { turn: number; strokes: Stroke[] } | null;
		strokes = snap && snap.turn === turn ? snap.strokes.map((s) => ({ ...s, p: [...s.p] })) : [];
		redraw();
	});

	// Remote strokes. The drawer ignores their own echo.
	$effect(() =>
		stream.subscribe((from, raw) => {
			if (from !== null && from === youId) return;
			apply(raw as StreamEvent);
			redraw();
		})
	);

	// Keep the backing store sharp on any screen size.
	$effect(() => {
		const ro = new ResizeObserver(() => {
			const dpr = Math.min(window.devicePixelRatio || 1, 2);
			const { width: w, height: h } = canvas.getBoundingClientRect();
			canvas.width = Math.round(w * dpr);
			canvas.height = Math.round(h * dpr);
			redraw();
		});
		ro.observe(canvas);
		return () => ro.disconnect();
	});

	function apply(e: StreamEvent) {
		if (e.t === 'clear') strokes = [];
		else if (e.t === 'undo') strokes.pop();
		else {
			const last = strokes.at(-1);
			if (last && last.id === e.id) last.p.push(...e.p);
			else strokes.push({ id: e.id, c: e.c, w: e.w, p: [...e.p] });
		}
	}

	function redraw() {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(paint);
	}

	function paint() {
		if (!canvas) return;
		const ctx = canvas.getContext('2d')!;
		const { width: W, height: H } = canvas;
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, W, H);
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		// Brush sizes are relative to an 800px-wide canvas.
		const scale = W / 800;
		for (const s of strokes) {
			ctx.strokeStyle = COLORS[s.c]!;
			ctx.fillStyle = COLORS[s.c]!;
			ctx.lineWidth = WIDTHS[s.w]! * scale;
			const p = s.p;
			if (p.length === 2) {
				ctx.beginPath();
				ctx.arc(p[0]! * W, p[1]! * H, (WIDTHS[s.w]! * scale) / 2, 0, Math.PI * 2);
				ctx.fill();
				continue;
			}
			ctx.beginPath();
			ctx.moveTo(p[0]! * W, p[1]! * H);
			// Smooth through midpoints.
			for (let i = 2; i < p.length - 2; i += 2) {
				const mx = ((p[i]! + p[i + 2]!) / 2) * W;
				const my = ((p[i + 1]! + p[i + 3]!) / 2) * H;
				ctx.quadraticCurveTo(p[i]! * W, p[i + 1]! * H, mx, my);
			}
			ctx.lineTo(p[p.length - 2]! * W, p[p.length - 1]! * H);
			ctx.stroke();
		}
	}

	// ----- drawing (drawer only) -----
	// Points go on the local stroke immediately (no lag under the finger);
	// the network gets them in ~50ms batches.

	let current: { stroke: Stroke; pending: number[] } | null = null;
	let flushTimer: ReturnType<typeof setInterval> | undefined;

	function point(e: PointerEvent): number[] {
		const r = canvas.getBoundingClientRect();
		const clamp = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000;
		return [clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height)];
	}

	function flush() {
		if (!current || current.pending.length === 0) return;
		const { stroke, pending } = current;
		current.pending = [];
		stream.send({ t: 'stroke', id: stroke.id, c: stroke.c, w: stroke.w, p: pending });
	}

	function down(e: PointerEvent) {
		if (!canDraw || e.button > 0) return;
		e.preventDefault();
		canvas.setPointerCapture(e.pointerId);
		const p = point(e);
		const stroke: Stroke = { id: Math.random().toString(36).slice(2, 10), c: color, w: width, p };
		strokes.push(stroke);
		current = { stroke, pending: [...p] };
		redraw();
		flush();
		flushTimer = setInterval(flush, 50);
	}

	function move(e: PointerEvent) {
		if (!current) return;
		// Coalesced events give smooth lines on fast pens and touch.
		for (const ev of e.getCoalescedEvents?.() ?? [e]) {
			const p = point(ev);
			current.stroke.p.push(...p);
			current.pending.push(...p);
		}
		redraw();
	}

	function up() {
		if (!current) return;
		flush();
		clearInterval(flushTimer);
		current = null;
	}

	function command(event: StreamEvent) {
		up();
		apply(event);
		stream.send(event);
		redraw();
	}
</script>

<div class="doodle">
	<canvas
		bind:this={canvas}
		class:drawing={canDraw}
		aria-label={m.canvas}
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointercancel={up}
		onpointerleave={up}
	></canvas>

	{#if canDraw}
		<div class="tools">
			<div class="swatches" role="radiogroup" aria-label="Colors">
				{#each COLORS as c, i (c)}
					<button
						class="swatch"
						class:active={color === i}
						style:--c={c}
						role="radio"
						aria-checked={color === i}
						aria-label={m.color(i + 1)}
						onclick={() => (color = i)}
					></button>
				{/each}
			</div>
			<div class="sizes" role="radiogroup" aria-label="Brush sizes">
				{#each WIDTHS as w, i (w)}
					<button
						class="size"
						class:active={width === i}
						role="radio"
						aria-checked={width === i}
						aria-label={m.size(i + 1)}
						onclick={() => (width = i)}
					>
						<span style:width="{Math.min(22, w)}px" style:height="{Math.min(22, w)}px"></span>
					</button>
				{/each}
			</div>
			<div class="actions">
				<button class="btn ghost small" onclick={() => command({ t: 'undo' })}>{m.undo}</button>
				<button class="btn ghost small" onclick={() => command({ t: 'clear' })}>{m.clear}</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.doodle {
		display: grid;
		gap: 12px;
	}
	canvas {
		display: block;
		width: 100%;
		aspect-ratio: 4 / 3;
		border: var(--border);
		border-radius: var(--radius);
		background: #fff;
		box-shadow: var(--shadow);
		touch-action: none;
	}
	.drawing {
		cursor: crosshair;
	}
	.tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 16px;
	}
	.swatches,
	.sizes,
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.swatch,
	.size {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		padding: 0;
		border: var(--border);
		border-radius: 50%;
		background: var(--c, var(--surface));
		--ink: var(--indigo);
		--ink-soft: var(--faded);
		--line: var(--indigo);
		--border: 1.5px solid var(--indigo);
		--stitch: 1.5px dashed var(--indigo);
		--good: #1d6a43;
		--danger: var(--madder);
		--warn: #855700;
		color: var(--ink);
		cursor: pointer;
		transition:
			transform 120ms ease-out,
			box-shadow 120ms ease-out;
	}
	.size span {
		border-radius: 50%;
		background: var(--ink);
	}
	.active {
		outline: 2.5px solid var(--ink);
		outline-offset: 3px;
	}
	.swatch:focus-visible,
	.size:focus-visible {
		outline: 2.5px dashed var(--focus);
		outline-offset: 3px;
	}
</style>
