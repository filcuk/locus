/**
 * Feature-local strings for the new-entry screen.
 * Fold into `src/i18n/catalogue` when this surface grows past the minimal form.
 */
export const newEntryMessages = {
  'new.point.titleLabel': 'Title',
  'new.point.titlePlaceholder': 'Point title',
  'new.point.latLabel': 'Latitude',
  'new.point.lonLabel': 'Longitude',
  'new.point.usePlaceholderCoords': 'Use placeholder coordinates',
  'new.point.placeholderHint': 'Placeholder: {lat}, {lon}',
  'new.point.save': 'Save point',
  'new.point.saving': 'Saving…',
  'new.point.saved': 'Saved offline as {id}',
  'new.point.errorTitle': 'Could not save',
  'new.point.errorCoords': 'Enter valid latitude (−90…90) and longitude (−180…180).',
  'new.point.errorTitleRequired': 'Enter a title.',
} as const;

export type NewEntryMessageKey = keyof typeof newEntryMessages;

export function tm(
  key: NewEntryMessageKey,
  vars?: Record<string, string | number>,
): string {
  const template = newEntryMessages[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = vars[name];
    return value === undefined ? `{${name}}` : String(value);
  });
}
