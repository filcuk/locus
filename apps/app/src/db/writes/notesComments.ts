/**
 * Offline-capable local Note / Comment writes (DESIGN §4 / §8).
 */
import { newEntityId, type TargetType } from '@locus/shared';
import type { Database } from '@nozbe/watermelondb';

import Comment from '../models/Comment';
import Note from '../models/Note';

export type CreateNoteLocalInput = {
  id?: string;
  authorId: string;
  targetType: TargetType;
  targetId: string;
  body?: string | null;
  visitedAt?: Date | null;
};

export type CreateCommentLocalInput = {
  id?: string;
  authorId: string;
  targetType: TargetType;
  targetId: string;
  body: string;
};

export async function createNoteLocal(
  database: Database,
  input: CreateNoteLocalInput,
): Promise<Note> {
  if (input.body == null && input.visitedAt == null) {
    throw new Error('A note requires body or visited_at (or both)');
  }
  const id = input.id ?? newEntityId();
  const now = Date.now();

  return database.write(async () =>
    database.get<Note>('notes').create((row) => {
      row._raw.id = id;
      row.authorId = input.authorId;
      row.targetType = input.targetType;
      row.targetId = input.targetId;
      row.body = input.body ?? null;
      row.visitedAt = input.visitedAt ?? null;
      row.updatedAt = new Date(now);
      row.deletedAt = null;
    }),
  );
}

export async function softDeleteNoteLocal(
  database: Database,
  note: Note,
): Promise<void> {
  await database.write(async () => {
    await note.update((row) => {
      row.deletedAt = new Date();
      row.updatedAt = new Date();
    });
  });
}

export async function createCommentLocal(
  database: Database,
  input: CreateCommentLocalInput,
): Promise<Comment> {
  const body = input.body.trim();
  if (body.length === 0) {
    throw new Error('Comment body is required');
  }
  const id = input.id ?? newEntityId();
  const now = Date.now();

  return database.write(async () =>
    database.get<Comment>('comments').create((row) => {
      row._raw.id = id;
      row.authorId = input.authorId;
      row.targetType = input.targetType;
      row.targetId = input.targetId;
      row.body = body;
      row.updatedAt = new Date(now);
      row.deletedAt = null;
    }),
  );
}

export async function softDeleteCommentLocal(
  database: Database,
  comment: Comment,
): Promise<void> {
  await database.write(async () => {
    await comment.update((row) => {
      row.deletedAt = new Date();
      row.updatedAt = new Date();
    });
  });
}
