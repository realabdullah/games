import type { Handle } from '@sveltejs/kit';
import { DEFAULT_SEO, renderSeoTags } from '$lib/seo';

/**
 * Room and pack pages render in the browser only, so their HTML (including the
 * 200.html fallback that serves every invite link) has no tags from <Seo>.
 * Give those a default social card, and keep them out of search results.
 */
const fallbackTags = renderSeoTags({ ...DEFAULT_SEO, noindex: true });

export const handle: Handle = ({ event, resolve }) =>
	resolve(event, {
		transformPageChunk: ({ html }) =>
			html.includes('property="og:title"')
				? html
				: html.replace('</head>', `\t${fallbackTags}\n\t</head>`)
	});
