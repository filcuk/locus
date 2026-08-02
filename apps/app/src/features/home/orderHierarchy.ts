import { type LatLon, distanceMeters } from '@locus/shared';

import { areaOwnDistanceMeters } from './areaDistance';
import type { EntryRecord, HierarchyNode, LocationFix } from './types';

/**
 * Build the Home tree and order it per DESIGN §8:
 * hierarchy preserved; roots (and children within a parent) sorted by
 * distance when a fix exists, otherwise by most-recently-updated.
 */
export function buildOrderedHierarchy(
  records: readonly EntryRecord[],
  fix: LocationFix,
): HierarchyNode[] {
  const byId = new Map<string, EntryRecord>();
  for (const record of records) {
    byId.set(recordKey(record), record);
  }

  const childrenOf = new Map<string, EntryRecord[]>();
  const roots: EntryRecord[] = [];

  for (const record of records) {
    const parentKey = parentKeyOf(record);
    if (parentKey && byId.has(parentKey)) {
      const siblings = childrenOf.get(parentKey) ?? [];
      siblings.push(record);
      childrenOf.set(parentKey, siblings);
      continue;
    }
    roots.push(record);
  }

  const nodes = roots.map((record) => toNode(record, childrenOf));
  annotateDistances(nodes, fix);
  sortTree(nodes, fix);
  return nodes;
}

function recordKey(record: EntryRecord): string {
  return `${record.kind}:${record.id}`;
}

function parentKeyOf(record: EntryRecord): string | null {
  if (record.kind === 'place' && record.areaId) {
    return `area:${record.areaId}`;
  }
  if (record.kind === 'point') {
    if (record.placeId) return `place:${record.placeId}`;
    if (record.areaId) return `area:${record.areaId}`;
  }
  return null;
}

function toNode(
  record: EntryRecord,
  childrenOf: Map<string, EntryRecord[]>,
): HierarchyNode {
  const childRecords = childrenOf.get(recordKey(record)) ?? [];
  return {
    record,
    children: childRecords.map((child) => toNode(child, childrenOf)),
    distanceMeters: null,
    youAreHere: false,
  };
}

function annotateDistances(nodes: HierarchyNode[], fix: LocationFix): void {
  for (const node of nodes) {
    annotateDistances(node.children, fix);
    if (!fix) {
      node.distanceMeters = null;
      node.youAreHere = false;
      continue;
    }
    const own = ownDistanceMeters(node.record, fix);
    let best = own;
    for (const child of node.children) {
      if (child.distanceMeters != null && child.distanceMeters < best) {
        best = child.distanceMeters;
      }
    }
    node.distanceMeters = best;
    node.youAreHere = node.record.kind === 'area' && own === 0;
  }
}

function ownDistanceMeters(record: EntryRecord, fix: LatLon): number {
  if (record.kind === 'area') {
    if (!record.geomGeojson) return Number.POSITIVE_INFINITY;
    return areaOwnDistanceMeters(fix, record.geomGeojson);
  }
  if (record.lat == null || record.lon == null) {
    return Number.POSITIVE_INFINITY;
  }
  return distanceMeters(fix, { lat: record.lat, lon: record.lon });
}

function sortTree(nodes: HierarchyNode[], fix: LocationFix): void {
  for (const node of nodes) {
    sortTree(node.children, fix);
  }
  if (fix) {
    nodes.sort((a, b) => {
      const da = a.distanceMeters ?? Number.POSITIVE_INFINITY;
      const db = b.distanceMeters ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      return compareRecencyThenTitle(a, b);
    });
    return;
  }
  nodes.sort(compareRecencyThenTitle);
}

function compareRecencyThenTitle(a: HierarchyNode, b: HierarchyNode): number {
  if (a.record.updatedAt !== b.record.updatedAt) {
    return b.record.updatedAt - a.record.updatedAt;
  }
  return a.record.title.localeCompare(b.record.title);
}
