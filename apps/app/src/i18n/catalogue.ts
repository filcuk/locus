/**
 * String catalogue skeleton. The i18n library is unchosen (DESIGN §13);
 * callers use `t(key)` so a real library can drop in later without rewriting screens.
 */
export const catalogue = {
  'serverSetup.title': 'Server URL',
  'serverSetup.subtitle': 'Enter the address of your Locus instance.',
  'serverSetup.urlLabel': 'Server URL',
  'serverSetup.urlPlaceholder': 'https://locus.example.com',
  'serverSetup.continue': 'Continue',
  'serverSetup.invalidUrl': 'Enter a valid http or https URL.',

  'auth.login.title': 'Sign in',
  'auth.login.subtitle': 'Sign in to your Locus instance.',
  'auth.login.submit': 'Sign in',
  'auth.login.invalidCredentials': 'Email or password is incorrect.',
  'auth.login.toRegister': 'Create an account',
  'auth.login.toForgot': 'Forgot password?',

  'auth.register.title': 'Create account',
  'auth.register.subtitle': 'Register on your Locus instance.',
  'auth.register.submit': 'Create account',
  'auth.register.emailTaken': 'That email is already registered.',
  'auth.register.validation': 'Check your details and try again.',
  'auth.register.toLogin': 'Already have an account? Sign in',

  'auth.forgotPassword.title': 'Reset password',
  'auth.forgotPassword.subtitle':
    'If an account exists for that email, a reset link will be sent.',
  'auth.forgotPassword.submit': 'Send reset link',
  'auth.forgotPassword.sent':
    'If an account exists for that email, a reset link will be sent.',
  'auth.forgotPassword.unavailable':
    'Password reset is temporarily unavailable. Try again later.',
  'auth.forgotPassword.toLogin': 'Back to sign in',

  'auth.fields.email': 'Email',
  'auth.fields.password': 'Password',
  'auth.fields.displayName': 'Display name',

  'auth.errors.generic': 'Something went wrong. Try again.',
  'auth.errors.network':
    'Could not reach the server. Check the URL and that the instance allows plain HTTP if you are not using HTTPS.',
  'auth.errors.rateLimited': 'Too many attempts. Wait a moment and try again.',

  'home.title': 'Home',
  'home.entriesTab': 'Entries',
  'home.collectionsTab': 'Collections',
  'home.empty': 'No entries yet.',
  'home.add': 'Add entry',
  'home.youAreHere': 'You are here',
  'home.distance.here': 'here',
  'home.kind.area': 'Area',
  'home.kind.place': 'Place',
  'home.kind.point': 'Point',
  /** OS permission copy — keep in sync with `expo-location` plugin in app.config.ts. */
  'home.location.permissionReason':
    'Locus uses your location once to sort nearby places on Home.',

  'collections.title': 'Collections',
  'collections.empty': 'No collections yet.',
  'collections.memberCount': '{count} members',
  'collections.add': 'New collection',
  'collections.createTitle': 'Title',
  'collections.createPlaceholder': 'Collection name',
  'collections.createSubmit': 'Create',
  'collections.createCancel': 'Cancel',
  'collections.createErrorTitle': 'Enter a title.',

  'map.title': 'Map',

  'new.title': 'New entry',
  'new.stub': 'Type and parent picker arrives in P1.',

  'search.title': 'Search',
  'search.placeholder': 'Search titles, descriptions, tags',
  'search.prompt': 'Type to search your local entries.',
  'search.empty': 'No matching entries.',
  'search.open': 'Search',
  'search.kind.area': 'Area',
  'search.kind.place': 'Place',
  'search.kind.point': 'Point',
  'search.kind.collection': 'Collection',
  'search.match.title': 'title',
  'search.match.description': 'description',
  'search.match.tag': 'tag',

  'area.detail.title': 'Area',
  'area.detail.stub': 'Area detail arrives in P2.',

  'place.detail.title': 'Place',
  'place.detail.stub': 'Place detail arrives in P1.',

  'point.detail.title': 'Point',
  'point.detail.stub': 'Point detail arrives in P1.',

  'entry.detail.missing': 'This entry was deleted or is unavailable.',
  'entry.detail.noDescription': 'No description.',
  'entry.detail.visits': 'Visits',
  'entry.detail.visitCount': '{count} visits',
  'entry.detail.lastVisit': 'last {when}',
  'entry.detail.timeline': 'Notes & comments',
  'entry.detail.timelineEmpty': 'No notes or comments yet.',
  'entry.timeline.note': 'Note',
  'entry.timeline.visit': 'Visit',
  'entry.timeline.comment': 'Comment',
  'entry.fab.open': 'Add',
  'entry.fab.addVisit': 'Add visit',
  'entry.fab.addNote': 'Add note',
  'entry.fab.addComment': 'Add comment',
  'entry.composer.visitPlaceholder': 'Optional note for this visit',
  'entry.composer.notePlaceholder': 'Write a private note',
  'entry.composer.commentPlaceholder': 'Write a comment',
  'entry.composer.cancel': 'Cancel',
  'entry.composer.save': 'Save',

  'collection.detail.title': 'Collection',
  'collection.detail.missing': 'This collection was deleted or is unavailable.',
  'collection.detail.members': 'Members',
  'collection.detail.membersEmpty': 'No members yet.',
  'collection.detail.add': 'Add from your entries',
  'collection.detail.addEmpty': 'No other entries to add.',
  'collection.detail.remove': 'Remove',
  'collection.detail.addAction': 'Add',
  'collection.detail.kind.area': 'Area',
  'collection.detail.kind.place': 'Place',
  'collection.detail.kind.point': 'Point',

  'share.title': 'Sharing',
  'share.stub': 'Access management arrives in P4.',

  'settings.title': 'Settings',
  'settings.profile': 'Profile',
  'settings.security': 'Security',
  'settings.invites': 'Invites',
  'settings.tags': 'Tags',
  'settings.notifications': 'Notifications',
  'settings.storage': 'Storage',
  'settings.sync': 'Sync',
  'settings.trash': 'Trash',
  'settings.stub': 'This settings screen arrives in a later phase.',

  'publicLink.title': 'Shared link',
  'publicLink.stub': 'Public read-only view arrives in P4.',

  'common.loading': 'Loading…',
  'common.back': 'Back',

  'syncStatus.offline': 'Offline',
  'syncStatus.syncing': 'Syncing',
  'syncStatus.live': 'Live',
  'syncStatus.error': 'Error',
  /** Quiet power-saving rest (online, not Live) — not a DESIGN §5 mode label. */
  'syncStatus.idle': 'Online',
} as const;

export type MessageKey = keyof typeof catalogue;

export function t(
  key: MessageKey,
  vars?: Readonly<Record<string, string | number>>,
): string {
  let out: string = catalogue[key];
  if (!vars) return out;
  for (const [name, value] of Object.entries(vars)) {
    out = out.replaceAll(`{${name}}`, String(value));
  }
  return out;
}
