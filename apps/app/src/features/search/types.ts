export type SearchKind = 'area' | 'place' | 'point' | 'collection';

export type SearchMatchField = 'title' | 'description' | 'tag';

/** Plain row for pure matching — no WatermelonDB types. */
export type SearchableRecord = {
  id: string;
  kind: SearchKind;
  title: string;
  description: string | null;
  /** Unix ms — WatermelonDB `updated_at`. */
  updatedAt: number;
  /** Labels already filtered to tags the viewer may see. */
  tagLabels: readonly string[];
};

export type SearchResult = SearchableRecord & {
  matchField: SearchMatchField;
};

export type TagVisibilityInput = {
  scope: string;
  ownerId: string | null;
};
