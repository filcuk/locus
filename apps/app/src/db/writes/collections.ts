/**
 * Offline-capable local Collection / CollectionItem writes (DESIGN §4 / §8).
 */
import { newEntityId, type CollectionItemType, type Visibility } from '@locus/shared';
import type { Database } from '@nozbe/watermelondb';

import Collection from '../models/Collection';
import CollectionItem from '../models/CollectionItem';

export type CreateCollectionLocalInput = {
  id?: string;
  ownerId: string;
  title: string;
  description?: string | null;
  visibility?: Visibility;
  updatedBy?: string;
};

export type UpdateCollectionLocalInput = {
  title?: string;
  description?: string | null;
  visibility?: Visibility;
  updatedBy: string;
};

export type CreateCollectionItemLocalInput = {
  id?: string;
  collectionId: string;
  itemType: CollectionItemType;
  itemId: string;
  position?: number | null;
};

export async function createCollectionLocal(
  database: Database,
  input: CreateCollectionLocalInput,
): Promise<Collection> {
  const id = input.id ?? newEntityId();
  const now = Date.now();
  const updatedBy = input.updatedBy ?? input.ownerId;

  return database.write(async () =>
    database.get<Collection>('collections').create((row) => {
      row._raw.id = id;
      row.ownerId = input.ownerId;
      row.title = input.title;
      row.description = input.description ?? null;
      row.visibility = input.visibility ?? 'private';
      row.updatedAt = new Date(now);
      row.updatedBy = updatedBy;
      row.deletedAt = null;
    }),
  );
}

export async function updateCollectionLocal(
  database: Database,
  collection: Collection,
  input: UpdateCollectionLocalInput,
): Promise<Collection> {
  const now = new Date();

  return database.write(async () =>
    collection.update((row) => {
      if (input.title !== undefined) row.title = input.title;
      if (input.description !== undefined) row.description = input.description;
      if (input.visibility !== undefined) row.visibility = input.visibility;
      row.updatedAt = now;
      row.updatedBy = input.updatedBy;
    }),
  );
}

export async function softDeleteCollectionLocal(
  database: Database,
  collection: Collection,
): Promise<void> {
  const now = new Date();
  await database.write(async () => {
    // Filter in memory: LokiJS optional-column equality can miss parent ids.
    const items = (
      await database.get<CollectionItem>('collection_items').query().fetch()
    ).filter(
      (item) => item.collectionId === collection.id && item.deletedAt == null,
    );
    for (const item of items) {
      await item.update((row) => {
        row.deletedAt = now;
        row.updatedAt = now;
      });
    }
    await collection.update((row) => {
      row.deletedAt = now;
      row.updatedAt = now;
    });
  });
}

export async function createCollectionItemLocal(
  database: Database,
  input: CreateCollectionItemLocalInput,
): Promise<CollectionItem> {
  const id = input.id ?? newEntityId();
  const now = Date.now();

  return database.write(async () =>
    database.get<CollectionItem>('collection_items').create((row) => {
      row._raw.id = id;
      row.collectionId = input.collectionId;
      row.itemType = input.itemType;
      row.itemId = input.itemId;
      row.position = input.position ?? null;
      row.addedAt = new Date(now);
      row.updatedAt = new Date(now);
      row.deletedAt = null;
    }),
  );
}

export async function softDeleteCollectionItemLocal(
  database: Database,
  item: CollectionItem,
): Promise<void> {
  await database.write(async () => {
    await item.update((row) => {
      row.deletedAt = new Date();
      row.updatedAt = new Date();
    });
  });
}
