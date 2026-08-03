/**
 * Shared `marked` options for client and server (DESIGN §6 / §13 Settled).
 * Raw HTML in markdown source is stripped via {@link noRawHtmlMarkedExtension}.
 */
export const MARKED_OPTIONS = {
  gfm: true,
  breaks: false,
  pedantic: false,
} as const;

/**
 * Marked extension that emits nothing for raw HTML tokens.
 * Pair with server-side `sanitize-html` on public pages (DESIGN §8).
 */
export const noRawHtmlMarkedExtension = {
  renderer: {
    html(): string {
      return '';
    },
  },
} as const;
