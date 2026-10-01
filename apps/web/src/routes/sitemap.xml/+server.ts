import { catalog } from '$lib/catalog';
import { SITE_URL } from '$lib/seo';

export const prerender = true;

/** Public, server-rendered pages only. Rooms and individual packs are private and client-only. */
const paths = [
	'/',
	'/play',
	'/online',
	'/packs',
	'/packs/new',
	...catalog
		.filter((g) => g.status === 'live' && g.modes.includes('solo'))
		.map((g) => `/solo/${g.id}`)
];

export const GET = () => {
	const urls = paths.map((path) => `\t<url><loc>${SITE_URL}${path}</loc></url>`).join('\n');
	return new Response(
		`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
		{ headers: { 'content-type': 'application/xml' } }
	);
};
