import type { Database } from '@nozbe/watermelondb';
import type { TargetType } from '@locus/shared';

import { getSessionUser } from '@/auth';
import {
  createCommentLocal,
  createNoteLocal,
} from '@/db';
import type Comment from '@/db/models/Comment';
import type Note from '@/db/models/Note';
import { requestSyncPush } from '@/sync/activeDriver';
import { LOCAL_OWNER_PLACEHOLDER } from '../new-entry/constants';

async function authorId(): Promise<string> {
  return (await getSessionUser())?.id ?? LOCAL_OWNER_PLACEHOLDER;
}

export async function addOfflineNote(
  database: Database,
  input: {
    targetType: TargetType;
    targetId: string;
    body?: string | null;
    visitedAt?: Date | null;
  },
): Promise<Note> {
  const note = await createNoteLocal(database, {
    authorId: await authorId(),
    targetType: input.targetType,
    targetId: input.targetId,
    body: input.body,
    visitedAt: input.visitedAt,
  });
  requestSyncPush();
  return note;
}

export async function addOfflineVisit(
  database: Database,
  input: { targetType: TargetType; targetId: string; body?: string | null },
): Promise<Note> {
  return addOfflineNote(database, {
    ...input,
    visitedAt: new Date(),
  });
}

export async function addOfflineComment(
  database: Database,
  input: { targetType: TargetType; targetId: string; body: string },
): Promise<Comment> {
  const comment = await createCommentLocal(database, {
    authorId: await authorId(),
    targetType: input.targetType,
    targetId: input.targetId,
    body: input.body,
  });
  requestSyncPush();
  return comment;
}
