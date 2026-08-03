/**
 * Offline-capable local Tag / Tagging writes (DESIGN §4 / §8).
 */
import { newEntityId, type TargetType } from '@locus/shared';
import type { Database } from '@nozbe/watermelondb';

import Tag from '../models/Tag';
import Tagging from '../models/Tagging';

export type CreateUserTagLocalInput = {
  id?: string;
  ownerId: string;
  label: string;
  colour?: string | null;
  icon?: string | null;
};

export type CreateTaggingLocalInput = {
  id?: string;
  tag: Tag;
  targetType: TargetType;
  targetId: string;
};

/** Whether a tag may appear in the viewer's picker / filters (not chips). */
export function isTagAssignableByViewer(
  tag: { scope: string; ownerId: string | null; retiredAt: Date | null },
  viewerId: string | null,
): boolean {
  if (tag.retiredAt != null) return false;
  if (tag.scope === 'system') return true;
  if (tag.scope === 'user') {
    return viewerId != null && tag.ownerId === viewerId;
  }
  return false;
}

/** Catalog visibility — system + own user tags (including retired, for settings). */
export function isTagInViewerCatalog(
  tag: { scope: string; ownerId: string | null },
  viewerId: string | null,
): boolean {
  if (tag.scope === 'system') return true;
  if (tag.scope === 'user') {
    return viewerId != null && tag.ownerId === viewerId;
  }
  return false;
}

export async function createUserTagLocal(
  database: Database,
  input: CreateUserTagLocalInput,
): Promise<Tag> {
  const label = input.label.trim();
  if (label.length === 0) {
    throw new Error('Tag label is required');
  }
  const id = input.id ?? newEntityId();

  return database.write(async () =>
    database.get<Tag>('tags').create((row) => {
      row._raw.id = id;
      row.scope = 'user';
      row.ownerId = input.ownerId;
      row.namespace = null;
      row.label = label;
      row.colour = input.colour ?? null;
      row.icon = input.icon ?? null;
      row.retiredAt = null;
    }),
  );
}

export async function retireUserTagLocal(
  database: Database,
  tag: Tag,
  stripFromAll = false,
): Promise<void> {
  await database.write(async () => {
    await tag.update((row) => {
      row.retiredAt = new Date();
    });
    if (stripFromAll) {
      const related = await database
        .get<Tagging>('taggings')
        .query()
        .fetch();
      const now = new Date();
      for (const tagging of related) {
        if (tagging.tagId !== tag.id || tagging.deletedAt != null) continue;
        await tagging.update((row) => {
          row.deletedAt = now;
        });
      }
    }
  });
}

export async function createTaggingLocal(
  database: Database,
  input: CreateTaggingLocalInput,
): Promise<Tagging> {
  if (input.tag.retiredAt != null) {
    throw new Error('Cannot assign a retired tag');
  }
  const id = input.id ?? newEntityId();

  return database.write(async () =>
    database.get<Tagging>('taggings').create((row) => {
      row._raw.id = id;
      row.tagId = input.tag.id;
      row.targetType = input.targetType;
      row.targetId = input.targetId;
      row.deletedAt = null;
      row.tagLabel = input.tag.label;
      row.tagColour = input.tag.colour;
      row.tagScope = input.tag.scope;
      row.tagNamespace = input.tag.namespace;
    }),
  );
}

export async function softDeleteTaggingLocal(
  database: Database,
  tagging: Tagging,
): Promise<void> {
  await database.write(async () => {
    await tagging.update((row) => {
      row.deletedAt = new Date();
    });
  });
}
