import type { Database } from '@nozbe/watermelondb';

import { getSessionUser } from '../../auth';
import {
  createCollectionItemLocal,
  createCollectionLocal,
  softDeleteCollectionLocal,
  softDeleteCollectionItemLocal,
  updateCollectionLocal,
} from '../../db';
import type Collection from '../../db/models/Collection';
import type CollectionItem from '../../db/models/CollectionItem';
import { requestSyncPush } from '../../sync/activeDriver';
import { LOCAL_OWNER_PLACEHOLDER } from '../new-entry/constants';

import type { CollectionMemberKind } from './types';

export type CreateOfflineCollectionInput = {
  title: string;
  ownerId?: string;
};

export async function createOfflineCollection(
  database: Database,
  input: CreateOfflineCollectionInput,
): Promise<Collection> {
  const title = input.title.trim();
  const ownerId =
    input.ownerId ??
    (await getSessionUser())?.id ??
    LOCAL_OWNER_PLACEHOLDER;

  const collection = await createCollectionLocal(database, {
    ownerId,
    title,
  });
  requestSyncPush();
  return collection;
}

export type AddOfflineCollectionMemberInput = {
  collectionId: string;
  itemType: CollectionMemberKind;
  itemId: string;
};

export async function addOfflineCollectionMember(
  database: Database,
  input: AddOfflineCollectionMemberInput,
): Promise<CollectionItem> {
  const item = await createCollectionItemLocal(database, {
    collectionId: input.collectionId,
    itemType: input.itemType,
    itemId: input.itemId,
  });
  requestSyncPush();
  return item;
}

export type UpdateOfflineCollectionInput = {
  title: string;
};

export async function updateOfflineCollection(
  database: Database,
  collection: Collection,
  input: UpdateOfflineCollectionInput,
): Promise<Collection> {
  const title = input.title.trim();
  if (title.length === 0) {
    throw new Error('Collection title is required');
  }

  const updatedBy = (await getSessionUser())?.id ?? LOCAL_OWNER_PLACEHOLDER;
  const updated = await updateCollectionLocal(database, collection, {
    title,
    updatedBy,
  });
  requestSyncPush();
  return updated;
}

export async function deleteOfflineCollection(
  database: Database,
  collection: Collection,
): Promise<void> {
  await softDeleteCollectionLocal(database, collection);
  requestSyncPush();
}

export async function removeOfflineCollectionMember(
  database: Database,
  item: CollectionItem,
): Promise<void> {
  await softDeleteCollectionItemLocal(database, item);
  requestSyncPush();
}
