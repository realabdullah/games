import { expect, test } from 'bun:test';
import { renderSeoTags, seoTags, SITE_URL } from './seo';

const content = (tags: ReturnType<typeof seoTags>, key: string) =>
	tags.meta.find((m) => ('name' in m ? m.name : m.property) === key)?.content;

test('page tags use absolute URLs for the canonical link and image', () => {
	const tags = seoTags({
		title: 'Trivia',
		description: 'Quiz night',
		path: '/solo/trivia',
		image: '/og/trivia.png'
	});
	expect(tags.canonical).toBe(`${SITE_URL}/solo/trivia`);
	expect(content(tags, 'og:url')).toBe(`${SITE_URL}/solo/trivia`);
	expect(content(tags, 'og:image')).toBe(`${SITE_URL}/og/trivia.png`);
	expect(content(tags, 'twitter:card')).toBe('summary_large_image');
	expect(content(tags, 'robots')).toBeUndefined();
});

test('pages without a path get the default image, no canonical, and can opt out of indexing', () => {
	const tags = seoTags({ title: 'Room', description: 'Join', noindex: true });
	expect(tags.canonical).toBeNull();
	expect(content(tags, 'og:url')).toBeUndefined();
	expect(content(tags, 'og:image')).toBe(`${SITE_URL}/og/default.png`);
	expect(content(tags, 'robots')).toBe('noindex');
});

test('rendered tags escape their values', () => {
	const html = renderSeoTags({ title: 'Tom & "Jerry" <3', description: "it's on" });
	expect(html).toContain('<title>Tom &#38; &#34;Jerry&#34; &#60;3</title>');
	expect(html).toContain('<meta name="description" content="it&#39;s on" />');
	expect(html).not.toContain('<3');
});
