import { defineConfig, InputTransformerFn } from "orval";
import path from "path";

const root = path.resolve(__dirname, "..", "..");
const apiClientReactSrc = path.resolve(root, "lib", "api-client-react", "src");
const apiZodSrc = path.resolve(root, "lib", "api-zod", "src");
const householdQueryKey = {
  path: path.resolve(apiClientReactSrc, "query-key.ts"),
  name: "buildHouseholdQueryKey",
};

// Our exports make assumptions about the title of the API being "Api" (i.e. generated output is `api.ts`).
const titleTransformer: InputTransformerFn = (config) => {
  config.info ??= {};
  config.info.title = "Api";

  return config;
};

export default defineConfig({
  "api-client-react": {
    input: {
      target: "./openapi.yaml",
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiClientReactSrc,
      target: "generated",
      client: "react-query",
      mode: "split",
      baseUrl: "/api",
      clean: true,
      headers: true,
      formatter: "prettier",
      tsconfig: path.resolve(root, "lib", "api-client-react", "tsconfig.json"),
      override: {
        operations: {
          listMyHouseholdMemberships: {
            query: { queryKey: householdQueryKey },
          },
          listHouseholdInvitations: { query: { queryKey: householdQueryKey } },
          listHouseholdSharingCleanup: {
            query: { queryKey: householdQueryKey },
          },
          listHouseholdAuditEvents: { query: { queryKey: householdQueryKey } },
          getCareState: { query: { queryKey: householdQueryKey } },
          listCareEntries: { query: { queryKey: householdQueryKey } },
          listCareEntryTombstones: { query: { queryKey: householdQueryKey } },
        },
        fetch: {
          includeHttpResponseReturnType: false,
        },
        mutator: {
          path: path.resolve(apiClientReactSrc, "custom-fetch.ts"),
          name: "customFetch",
        },
      },
    },
  },
  zod: {
    input: {
      target: "./openapi.yaml",
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiZodSrc,
      client: "zod",
      target: "generated",
      schemas: { path: "generated/types", type: "typescript" },
      mode: "split",
      clean: true,
      formatter: "prettier",
      override: {
        zod: {
          generateEachHttpStatus: true,
          coerce: {
            query: ["boolean", "number", "string"],
            param: ["boolean", "number", "string"],
            body: ["bigint", "date"],
            response: ["bigint", "date"],
          },
        },
        useDates: true,
        useBigInt: true,
      },
    },
  },
});
