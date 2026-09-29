import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
export type AdministrativeLevel = 'sido' | 'sigungu';
export interface BoundaryProperties { shapeName: string; shapeISO: string; shapeID: string; shapeGroup: string; shapeType: string }
export type BoundaryFeature = Feature<Polygon | MultiPolygon, BoundaryProperties>;
export type BoundaryCollection = FeatureCollection<Polygon | MultiPolygon, BoundaryProperties>;
export interface BoundarySelection { level: AdministrativeLevel; code: string; name: string; parentCode: string | null }
/** ADM2 can supply another collection and parent key later; no fabricated child geometry. */
export interface BoundaryLayer { level: AdministrativeLevel; parentCode: string | null; data: BoundaryCollection }
