import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const GAME_SERVER = process.env.GAME_SERVER ?? 'http://localhost:3001';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// Room pages aren't prerendered; the static server falls back to 200.html for them.
			adapter: adapter({ fallback: '200.html' })
		})
	],
	server: {
		proxy: {
			'/api': GAME_SERVER,
			'/ws': { target: GAME_SERVER.replace(/^http/, 'ws'), ws: true }
		}
	}
});
