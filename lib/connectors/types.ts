export type ConnectorType =
  | "CRM"
  | "MLS"
  | "TRANSACTION"
  | "COMMUNITY"
  | "SCHOOL"
  | "METRO"
  | "AIRPORT"
  | "OTHER";

export interface NormalizedProperty {
  externalId: string;
  source: string;
  title: string;
  description?: string;
  propertyType?: string;
  priceAED?: number;
  bedrooms?: number;
  bathrooms?: number;
  areaSqft?: number;
  plotAreaSqft?: number;
  latitude?: number;
  longitude?: number;
  community?: string;
  developer?: string;
  waterfront?: boolean;
  privateBeach?: boolean;
  furnished?: boolean;
  offPlan?: boolean;
  ready?: boolean;
  images?: string[];
  amenities?: string[];
  metadata?: Record<string, unknown>;
}

export interface Connector<TRaw = unknown> {
  name: string;
  type: ConnectorType;
  fetchPage(page: number): Promise<TRaw[]>;
  normalize(raw: TRaw): NormalizedProperty | NormalizedProperty[];
}
