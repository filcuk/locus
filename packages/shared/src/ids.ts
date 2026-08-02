import { v7 as uuidv7 } from 'uuid';

/** Client-generated primary keys — UUIDv7 (DESIGN §4). */
export function newEntityId(): string {
  return uuidv7();
}
