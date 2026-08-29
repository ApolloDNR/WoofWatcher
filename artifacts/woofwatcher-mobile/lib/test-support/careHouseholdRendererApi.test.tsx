import { useMutation, useQuery } from "@tanstack/react-query";

export type RendererApiCall = Readonly<{
  name: string;
  args: readonly unknown[];
}>;

type Handler = (...args: any[]) => any;

const calls: RendererApiCall[] = [];
let handlers: Record<string, Handler> = {};

function invoke(name: string, args: readonly unknown[]): any {
  calls.push(Object.freeze({ name, args: Object.freeze([...args]) }));
  const handler = handlers[name];
  if (!handler) throw new Error(`Unexpected renderer API call: ${name}`);
  return handler(...args);
}

export function resetCareHouseholdRendererApi(
  next: Record<string, Handler> = {},
): void {
  calls.length = 0;
  handlers = { ...next };
}

export function setCareHouseholdRendererApiHandlers(
  next: Record<string, Handler>,
): void {
  handlers = { ...handlers, ...next };
}

export function getCareHouseholdRendererApiCalls(): readonly RendererApiCall[] {
  return calls;
}

export const getGetMeQueryKey = () => ["/api/me"] as const;
export const getListCareEntriesHouseholdQueryKey = (
  headers: Record<string, string>,
  params?: unknown,
) => [
  "/api/care-entries",
  headers["X-WoofWatcher-Expected-Household-Id"],
  { params },
] as const;

export const getMe = (...args: any[]) => invoke("getMe", args);
export const getCareState = (...args: any[]) => invoke("getCareState", args);
export const listCareEntries = (...args: any[]) =>
  invoke("listCareEntries", args);
export const putCareState = (...args: any[]) => invoke("putCareState", args);
export const createCareEntry = (...args: any[]) =>
  invoke("createCareEntry", args);
export const updateCareEntry = (...args: any[]) =>
  invoke("updateCareEntry", args);
export const deleteCareEntry = (...args: any[]) =>
  invoke("deleteCareEntry", args);
export const deleteCareEntryByClientKey = (...args: any[]) =>
  invoke("deleteCareEntryByClientKey", args);
export const listMyHouseholdMemberships = (...args: any[]) =>
  invoke("listMyHouseholdMemberships", args);
export const activateHousehold = (...args: any[]) =>
  invoke("activateHousehold", args);
export const createHouseholdInvitation = (...args: any[]) =>
  invoke("createHouseholdInvitation", args);
export const revokeHouseholdInvitation = (...args: any[]) =>
  invoke("revokeHouseholdInvitation", args);
export const joinHousehold = (...args: any[]) => invoke("joinHousehold", args);
export const updateHousehold = (...args: any[]) =>
  invoke("updateHousehold", args);
export const updateMe = (...args: any[]) => invoke("updateMe", args);

export function useGetMe(options: any = {}): any {
  const queryOptions = options.query ?? {};
  const queryKey = queryOptions.queryKey ?? getGetMeQueryKey();
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => getMe({ signal, ...(options.request ?? {}) }),
    ...queryOptions,
  });
  return { ...query, queryKey };
}

export function useUpdateMe(options: any = {}): any {
  return useMutation({
    mutationFn: ({ data }: { data: unknown }) =>
      updateMe(data, options.request),
    ...(options.mutation ?? {}),
  });
}

export function useJoinHousehold(options: any = {}): any {
  return useMutation({
    mutationFn: ({ data }: { data: unknown }) =>
      joinHousehold(data, options.request),
    ...(options.mutation ?? {}),
  });
}

export function useUpdateHousehold(options: any = {}): any {
  return useMutation({
    mutationFn: ({ data }: { data: unknown }) =>
      updateHousehold(data, options.request),
    ...(options.mutation ?? {}),
  });
}

export type CareEntry = any;
export type CareEntryInput = any;
export type CareEntryUpdate = any;
export type CareStateEnvelope = any;
