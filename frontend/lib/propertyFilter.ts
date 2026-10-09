import type { PropertyFilterProps } from "@cloudscape-design/components/property-filter";

export const EMPTY_QUERY: PropertyFilterProps.Query = { tokens: [], operation: "and" };

export function freeTextQuery(text: string): PropertyFilterProps.Query {
  const value = text.trim();
  return value ? { tokens: [{ operator: ":", value }], operation: "and" } : EMPTY_QUERY;
}

/** Values of the tokens for one property; omit the key to get the free-text tokens. */
export function tokenValues(query: PropertyFilterProps.Query, propertyKey?: string): string[] {
  return query.tokens
    .filter((token) => (token.propertyKey ?? undefined) === propertyKey)
    .map((token) => String(token.value ?? "").trim())
    .filter(Boolean);
}
