export type CollectionMemberKind = 'area' | 'place' | 'point';

export type CollectionListRow = {
  id: string;
  title: string;
  updatedAt: number;
  memberCount: number;
};

export type CollectionMemberRow = {
  membershipId: string;
  itemType: CollectionMemberKind;
  itemId: string;
  title: string;
};

export type AddableEntry = {
  itemType: CollectionMemberKind;
  itemId: string;
  title: string;
};
