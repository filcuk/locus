/**
 * Turf 6.x ships typings that do not resolve through package.json "exports"
 * under TypeScript `moduleResolution: "Bundler"`. These ambient modules keep
 * us on MIT-only Turf 6 (Turf 7 pulls `tslib` under 0BSD, not yet allow-listed).
 */
declare module '@turf/bbox' {
  export default function bbox(geojson: object): [number, number, number, number];
}

declare module '@turf/boolean-point-in-polygon' {
  export default function booleanPointInPolygon(point: object, polygon: object): boolean;
}

declare module '@turf/distance' {
  export default function distance(
    from: object,
    to: object,
    options?: { units?: string },
  ): number;
}

declare module '@turf/helpers' {
  export function point(
    coordinates: [number, number] | [number, number, number],
    properties?: Record<string, unknown>,
  ): object;
}

declare module '@turf/simplify' {
  export default function simplify<T extends object>(
    geojson: T,
    options?: { tolerance?: number; highQuality?: boolean; mutate?: boolean },
  ): T;
}
