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
  'auth.login.stub': 'Sign-in form arrives in P1.',
  'auth.register.title': 'Create account',
  'auth.register.stub': 'Registration arrives in P1.',
  'auth.forgotPassword.title': 'Reset password',
  'auth.forgotPassword.stub': 'Password reset arrives in P1.',

  'home.title': 'Home',
  'home.entriesTab': 'Entries',
  'home.collectionsTab': 'Collections',
  'home.empty': 'No entries yet.',

  'collections.title': 'Collections',
  'collections.empty': 'No collections yet.',

  'map.title': 'Map',

  'new.title': 'New entry',
  'new.stub': 'Type and parent picker arrives in P1.',

  'search.title': 'Search',
  'search.stub': 'Search arrives in a later phase.',

  'area.detail.title': 'Area',
  'area.detail.stub': 'Area detail arrives in P2.',

  'place.detail.title': 'Place',
  'place.detail.stub': 'Place detail arrives in P1.',

  'point.detail.title': 'Point',
  'point.detail.stub': 'Point detail arrives in P1.',

  'collection.detail.title': 'Collection',
  'collection.detail.stub': 'Collection detail arrives in a later phase.',

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

export function t(key: MessageKey): string {
  return catalogue[key];
}
