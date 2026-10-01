import { SITE_URL } from '$lib/seo';

export const prerender = true;

export const GET = () =>
	new Response(`User-agent: *\nDisallow:\n\nSitemap: ${SITE_URL}/sitemap.xml\n`, {
		headers: { 'content-type': 'text/plain; charset=utf-8' }
	});
