/**
 * Server-side markdown → safe HTML for public pages (DESIGN §6 / §8 / §13).
 * Client rendering uses `react-native-marked`; this path is for `p/[token]`.
 */
import { MARKED_OPTIONS, noRawHtmlMarkedExtension } from '@locus/shared';
import { Marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const PUBLIC_SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'h1', 'h2'],
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ['src', 'alt', 'title'],
    a: ['href', 'name', 'target', 'rel'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
};

const marked = new Marked();
marked.setOptions({ ...MARKED_OPTIONS, async: false });
marked.use(noRawHtmlMarkedExtension);

/** Parse markdown with shared options, then sanitise for anonymous HTML shells. */
export function markdownToSafeHtml(source: string): string {
  const raw = marked.parse(source);
  const html = typeof raw === 'string' ? raw : '';
  return sanitizeHtml(html, PUBLIC_SANITIZE);
}
