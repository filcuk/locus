import { useDatabase } from '@nozbe/watermelondb/hooks';
import { useEffect, useState } from 'react';

import { getSessionUser } from '@/auth';
import type Tag from '@/db/models/Tag';
import { isTagInViewerCatalog } from '@/db/writes/tags';

/**
 * Observes system tags + the signed-in user's private tags for settings / picker.
 */
export function useViewerTags(): {
  tags: Tag[];
  viewerId: string | null;
  loading: boolean;
} {
  const database = useDatabase();
  const [tags, setTags] = useState<Tag[] | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getSessionUser().then((user) => {
      if (!cancelled) setViewerId(user?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const sub = database
      .get<Tag>('tags')
      .query()
      .observe()
      .subscribe((rows) => {
        setTags(rows.filter((tag) => isTagInViewerCatalog(tag, viewerId)));
      });
    return () => sub.unsubscribe();
  }, [database, viewerId]);

  return { tags: tags ?? [], viewerId, loading: tags === null };
}
