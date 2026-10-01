import { t } from './i18n';

/** Social cards and canonical links need absolute URLs. Override per deploy with VITE_SITE_URL. */
export const SITE_URL = (
	(import.meta.env.VITE_SITE_URL as string | undefined) || 'https://games.abdspace.xyz'
).replace(/\/$/, '');

/** Same size as the PNGs in static/og (see scripts/og-images.ts). */
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

export interface Seo {
	title: string;
	description: string;
	/** Path on this site, e.g. "/solo/trivia". Omit for pages that shouldn't claim a canonical URL. */
	path?: string;
	/** Path under static/, e.g. "/og/trivia.png". */
	image?: string;
	noindex?: boolean;
}

export type MetaTag = { name: string; content: string } | { property: string; content: string };

export interface SeoTags {
	title: string;
	canonical: string | null;
	meta: MetaTag[];
}

export const DEFAULT_SEO: Seo = {
	title: `${t.appName}: party games for any group`,
	description: t.tagline,
	image: '/og/default.png'
};

const absolute = (path: string) => new URL(path, SITE_URL).href;

export const seoTags = (seo: Seo): SeoTags => {
	const image = absolute(seo.image ?? DEFAULT_SEO.image!);
	const url = seo.path ? absolute(seo.path) : null;

	const meta: MetaTag[] = [
		{ name: 'description', content: seo.description },
		{ property: 'og:type', content: 'website' },
		{ property: 'og:site_name', content: t.appName },
		{ property: 'og:title', content: seo.title },
		{ property: 'og:description', content: seo.description },
		{ property: 'og:image', content: image },
		{ property: 'og:image:width', content: String(OG_IMAGE_SIZE.width) },
		{ property: 'og:image:height', content: String(OG_IMAGE_SIZE.height) },
		{ property: 'og:image:alt', content: seo.title },
		{ name: 'twitter:card', content: 'summary_large_image' },
		{ name: 'twitter:title', content: seo.title },
		{ name: 'twitter:description', content: seo.description },
		{ name: 'twitter:image', content: image }
	];
	if (url) meta.push({ property: 'og:url', content: url });
	if (seo.noindex) meta.push({ name: 'robots', content: 'noindex' });

	return { title: seo.title, canonical: url, meta };
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The same tags as <Seo>, as HTML, for pages rendered without SSR. */
export const renderSeoTags = (seo: Seo): string => {
	const tags = seoTags(seo);
	const meta = tags.meta.map((tag) => {
		const [key, value] = 'name' in tag ? ['name', tag.name] : ['property', tag.property];
		return `<meta ${key}="${escapeHtml(value)}" content="${escapeHtml(tag.content)}" />`;
	});
	return [
		`<title>${escapeHtml(tags.title)}</title>`,
		...(tags.canonical ? [`<link rel="canonical" href="${escapeHtml(tags.canonical)}" />`] : []),
		...meta
	].join('\n\t\t');
};
