<script lang="ts">
	/** An on-screen QWERTY keyboard for letter games, coloured by what each letter turned out to be. */
	interface Props {
		/** hit: in place / in the word. near: elsewhere in the word. miss: not in it. */
		marks?: Record<string, 'hit' | 'near' | 'miss'>;
		/** Letters that can't be pressed again. */
		used?: readonly string[];
		disabled?: boolean;
		/** Accessible name for a key; defaults to the letter. */
		label?: (letter: string) => string;
		onletter: (letter: string) => void;
		onenter?: () => void;
		enterLabel?: string;
		onbackspace?: () => void;
		backspaceLabel?: string;
	}
	let {
		marks = {},
		used = [],
		disabled = false,
		label = (letter) => letter.toUpperCase(),
		onletter,
		onenter,
		enterLabel = 'Enter',
		onbackspace,
		backspaceLabel = 'Delete'
	}: Props = $props();

	const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].map((r) => [...r]);
</script>

<div class="keys" role="group">
	{#each ROWS as row, r (r)}
		<div class="row">
			{#if r === 2 && onenter}
				<button type="button" class="key wide" {disabled} onclick={onenter}>{enterLabel}</button>
			{/if}
			{#each row as letter (letter)}
				<button
					type="button"
					class="key {marks[letter] ?? ''}"
					disabled={disabled || used.includes(letter)}
					aria-label={label(letter)}
					onclick={() => onletter(letter)}>{letter}</button
				>
			{/each}
			{#if r === 2 && onbackspace}
				<button
					type="button"
					class="key wide"
					{disabled}
					aria-label={backspaceLabel}
					onclick={onbackspace}>⌫</button
				>
			{/if}
		</div>
	{/each}
</div>

<style>
	.keys {
		--hit: oklch(72% 0.17 150);
		--near: var(--yellow);
		--miss: oklch(72% 0.02 280);
		display: grid;
		gap: 6px;
		user-select: none;
		touch-action: manipulation;
	}
	.row {
		display: flex;
		justify-content: center;
		gap: 5px;
	}
	.key {
		flex: 1 1 0;
		max-width: 48px;
		min-width: 0;
		min-height: 54px;
		padding: 0;
		border: 2px solid var(--line);
		border-radius: 8px;
		background: var(--surface);
		color: var(--ink);
		box-shadow: 0 3px 0 var(--line);
		font: inherit;
		font-size: 1.15rem;
		font-weight: 800;
		text-transform: uppercase;
		cursor: pointer;
		transition: transform 80ms ease-out;
	}
	.key:active:not(:disabled) {
		transform: translateY(2px);
		box-shadow: 0 1px 0 var(--line);
	}
	.key:disabled {
		cursor: default;
	}
	.wide {
		flex-grow: 1.6;
		max-width: 76px;
		font-size: 0.85rem;
	}
	.hit {
		background: var(--hit);
	}
	.near {
		background: var(--near);
	}
	.miss {
		background: var(--miss);
		color: oklch(35% 0.02 280);
	}
	.key:disabled:not(.hit, .near, .miss) {
		opacity: 0.4;
	}
</style>
