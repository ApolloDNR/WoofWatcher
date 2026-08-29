import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const generatedClientPath = path.resolve(
  scriptDir,
  "..",
  "..",
  "api-client-react",
  "src",
  "generated",
  "api.ts",
);
const generatedSchemasPath = path.resolve(
  scriptDir,
  "..",
  "..",
  "api-client-react",
  "src",
  "generated",
  "api.schemas.ts",
);

const guardedOperations = [
  "updateHousehold",
  "listMyHouseholdMemberships",
  "activateHousehold",
  "listHouseholdInvitations",
  "createHouseholdInvitation",
  "revokeHouseholdInvitation",
  "joinHousehold",
  "updateHouseholdMember",
  "revokeHouseholdMember",
  "activateHouseholdAccessPass",
  "revokeHouseholdAccessPass",
  "listHouseholdSharingCleanup",
  "listHouseholdAuditEvents",
  "getCareState",
  "putCareState",
  "listCareEntries",
  "createCareEntry",
  "listCareEntryTombstones",
  "updateCareEntry",
  "deleteCareEntryByClientKey",
  "deleteCareEntry",
];

const encodedPathParameters = new Map([
  ["deleteCareEntryByClientKey", ["clientKey"]],
]);

const guardedQueries = new Set([
  "listMyHouseholdMemberships",
  "listHouseholdInvitations",
  "listHouseholdSharingCleanup",
  "listHouseholdAuditEvents",
  "getCareState",
  "listCareEntries",
  "listCareEntryTombstones",
]);

const generatedQueryOptionsType = "query?: UseQueryOptions<";
const hardenedQueryOptionsType = "query?: HouseholdBoundQueryOptions<";
const secondParameterDeclaration =
  "type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];";
const householdBoundQueryOptionsDeclaration = `type HouseholdBoundQueryOptions<TQueryFnData, TError, TData> = Omit<
  UseQueryOptions<TQueryFnData, TError, TData>,
  "queryKey" | "queryFn"
>;`;

const queryCompatibilityBlock = `

/**
 * Compatibility query helpers retain the established public names while
 * requiring the exact household capability in every cache identity.
 */
export const getGetCareStateQueryKey = (headers: GetCareStateHeaders) =>
  buildHouseholdQueryKey({ headers }, { url: "/api/care-state" });
export const getGetCareStateQueryOptions = useGetCareStateQueryOptions;

export const getListCareEntriesQueryKey = (
  headers: ListCareEntriesHeaders,
  params?: ListCareEntriesParams,
) => buildHouseholdQueryKey(
  { headers, params },
  { url: "/api/care-entries" },
);
export const getListCareEntriesQueryOptions = useListCareEntriesQueryOptions;

export const getListCareEntryTombstonesQueryKey = (
  headers: ListCareEntryTombstonesHeaders,
  params?: ListCareEntryTombstonesParams,
) => buildHouseholdQueryKey(
  { headers, params },
  { url: "/api/care-entries/tombstones" },
);
export const getListCareEntryTombstonesQueryOptions =
  useListCareEntryTombstonesQueryOptions;

export const getListHouseholdAuditEventsQueryKey = (
  headers: ListHouseholdAuditEventsHeaders,
  params?: ListHouseholdAuditEventsParams,
) => buildHouseholdQueryKey(
  { headers, params },
  { url: "/api/household/audit-events" },
);
export const getListHouseholdAuditEventsQueryOptions =
  useListHouseholdAuditEventsQueryOptions;

export const getListHouseholdInvitationsQueryKey = (
  headers: ListHouseholdInvitationsHeaders,
  params?: ListHouseholdInvitationsParams,
) => buildHouseholdQueryKey(
  { headers, params },
  { url: "/api/household/invitations" },
);
export const getListHouseholdInvitationsQueryOptions =
  useListHouseholdInvitationsQueryOptions;

export const getListHouseholdSharingCleanupQueryKey = (
  headers: ListHouseholdSharingCleanupHeaders,
  params?: ListHouseholdSharingCleanupParams,
) => buildHouseholdQueryKey(
  { headers, params },
  { url: "/api/household/sharing-cleanup" },
);
export const getListHouseholdSharingCleanupQueryOptions =
  useListHouseholdSharingCleanupQueryOptions;
`;

const schemaCompatibilityBlock = `

/** Deprecated compatibility alias for HouseholdAccessPassRole. */
export type AccessPassRole = HouseholdAccessPassRole;
/** Deprecated compatibility alias for HouseholdAuditEventAction. */
export type HouseholdAuditAction = HouseholdAuditEventAction;
/** Deprecated compatibility alias for HouseholdAuditEventLifecycleState. */
export type HouseholdAuditLifecycleState = HouseholdAuditEventLifecycleState;
`;

function pascal(value) {
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

let source = await readFile(generatedClientPath, "utf8");
let hardenedCount = 0;

const householdBoundTypeCount = [
  ...source.matchAll(/type HouseholdBoundQueryOptions\s*</g),
].length;
if (householdBoundTypeCount === 0) {
  const secondParameterCount =
    source.split(secondParameterDeclaration).length - 1;
  if (secondParameterCount !== 1) {
    throw new Error(
      `Generated client must contain exactly one SecondParameter declaration; found ${secondParameterCount}.`,
    );
  }
  source = source.replace(
    secondParameterDeclaration,
    `${secondParameterDeclaration}\n\n${householdBoundQueryOptionsDeclaration}`,
  );
} else if (householdBoundTypeCount !== 1) {
  throw new Error(
    `Generated client must contain at most one household-bound query options declaration; found ${householdBoundTypeCount}.`,
  );
}

for (const operation of guardedOperations) {
  const marker = `export const get${pascal(operation)}Url`;
  const start = source.indexOf(marker);
  if (start === -1) {
    throw new Error(`Cannot harden missing generated operation ${operation}.`);
  }

  const nextOperation = source
    .slice(start + marker.length)
    .search(/\nexport const get[A-Z][A-Za-z0-9]+Url\b/);
  const end =
    nextOperation === -1
      ? source.length
      : start + marker.length + nextOperation;
  const block = source.slice(start, end);
  const generatedHeaderOrder = /\.\.\.headers,(\s*)\.\.\.options\?\.headers/g;
  const hardenedHeaderOrder = /\.\.\.options\?\.headers,(\s*)\.\.\.headers/g;
  const generatedMatches = [...block.matchAll(generatedHeaderOrder)];
  const hardenedMatches = [...block.matchAll(hardenedHeaderOrder)];
  if (generatedMatches.length + hardenedMatches.length !== 1) {
    throw new Error(
      `${operation} must contain exactly one typed-header merge; found ${
        generatedMatches.length + hardenedMatches.length
      }.`,
    );
  }

  const hardenedBlock = generatedMatches.length
    ? block.replace(
        generatedHeaderOrder,
        (_match, whitespace) => `...options?.headers,${whitespace}...headers`,
      )
    : block;
  let securedBlock = hardenedBlock;

  if (guardedQueries.has(operation)) {
    const generatedQueryOptionsCount =
      securedBlock.split(generatedQueryOptionsType).length - 1;
    const hardenedQueryOptionsCount =
      securedBlock.split(hardenedQueryOptionsType).length - 1;
    if (generatedQueryOptionsCount + hardenedQueryOptionsCount !== 2) {
      throw new Error(
        `${operation} must contain exactly two guarded query-option types; found ${
          generatedQueryOptionsCount + hardenedQueryOptionsCount
        }.`,
      );
    }
    if (generatedQueryOptionsCount > 0) {
      securedBlock = securedBlock.replaceAll(
        generatedQueryOptionsType,
        hardenedQueryOptionsType,
      );
    }

    const generatedReturnOrder =
      /return \{ queryKey, queryFn, \.\.\.queryOptions \} as/g;
    const hardenedReturnOrder =
      /return \{ \.\.\.queryOptions, queryKey, queryFn \} as/g;
    const generatedReturnMatches = [
      ...securedBlock.matchAll(generatedReturnOrder),
    ];
    const hardenedReturnMatches = [
      ...securedBlock.matchAll(hardenedReturnOrder),
    ];
    if (generatedReturnMatches.length + hardenedReturnMatches.length !== 1) {
      throw new Error(
        `${operation} must contain exactly one guarded query-options return; found ${
          generatedReturnMatches.length + hardenedReturnMatches.length
        }.`,
      );
    }
    if (generatedReturnMatches.length > 0) {
      securedBlock = securedBlock.replace(
        generatedReturnOrder,
        "return { ...queryOptions, queryKey, queryFn } as",
      );
    }
  }

  for (const parameter of encodedPathParameters.get(operation) ?? []) {
    const generatedInterpolation = `\${${parameter}}`;
    const hardenedInterpolation = `\${encodeURIComponent(${parameter})}`;
    const generatedCount =
      securedBlock.split(generatedInterpolation).length - 1;
    const hardenedCount = securedBlock.split(hardenedInterpolation).length - 1;
    if (generatedCount + hardenedCount !== 1) {
      throw new Error(
        `${operation} must contain exactly one path interpolation for ${parameter}; found ${
          generatedCount + hardenedCount
        }.`,
      );
    }
    if (generatedCount === 1) {
      securedBlock = securedBlock.replace(
        generatedInterpolation,
        hardenedInterpolation,
      );
    }
  }

  source = `${source.slice(0, start)}${securedBlock}${source.slice(end)}`;
  hardenedCount += 1;
}

if (hardenedCount !== guardedOperations.length) {
  throw new Error(
    `Expected to harden ${guardedOperations.length} operations; hardened ${hardenedCount}.`,
  );
}

const queryCompatibilityCount =
  source.split(queryCompatibilityBlock).length - 1;
if (queryCompatibilityCount === 0) {
  for (const compatibilityExport of [
    "getGetCareStateQueryKey",
    "getGetCareStateQueryOptions",
    "getListCareEntriesQueryKey",
    "getListCareEntriesQueryOptions",
    "getListCareEntryTombstonesQueryKey",
    "getListCareEntryTombstonesQueryOptions",
    "getListHouseholdAuditEventsQueryKey",
    "getListHouseholdAuditEventsQueryOptions",
    "getListHouseholdInvitationsQueryKey",
    "getListHouseholdInvitationsQueryOptions",
    "getListHouseholdSharingCleanupQueryKey",
    "getListHouseholdSharingCleanupQueryOptions",
  ]) {
    if (new RegExp(`export const ${compatibilityExport}\\b`).test(source)) {
      throw new Error(
        `Generated client contains an unexpected partial compatibility export ${compatibilityExport}.`,
      );
    }
  }
  source += queryCompatibilityBlock;
} else if (queryCompatibilityCount !== 1) {
  throw new Error(
    `Generated client must contain at most one query compatibility block; found ${queryCompatibilityCount}.`,
  );
}

let schemasSource = await readFile(generatedSchemasPath, "utf8");
const schemaCompatibilityCount =
  schemasSource.split(schemaCompatibilityBlock).length - 1;
if (schemaCompatibilityCount === 0) {
  for (const [compatibilityName, canonicalName] of [
    ["AccessPassRole", "HouseholdAccessPassRole"],
    ["HouseholdAuditAction", "HouseholdAuditEventAction"],
    ["HouseholdAuditLifecycleState", "HouseholdAuditEventLifecycleState"],
  ]) {
    if (!new RegExp(`export type ${canonicalName}\\b`).test(schemasSource)) {
      throw new Error(
        `Generated schemas are missing canonical type ${canonicalName}.`,
      );
    }
    if (new RegExp(`export type ${compatibilityName}\\b`).test(schemasSource)) {
      throw new Error(
        `Generated schemas contain an unexpected partial compatibility type ${compatibilityName}.`,
      );
    }
  }
  schemasSource += schemaCompatibilityBlock;
} else if (schemaCompatibilityCount !== 1) {
  throw new Error(
    `Generated schemas must contain at most one compatibility block; found ${schemaCompatibilityCount}.`,
  );
}

await Promise.all([
  writeFile(generatedClientPath, source),
  writeFile(generatedSchemasPath, schemasSource),
]);
