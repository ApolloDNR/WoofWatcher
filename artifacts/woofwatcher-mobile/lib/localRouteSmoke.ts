export const LOCAL_ROUTE_SMOKE_TOKEN = "woofwatcher-local-route-smoke-v1";

type LocalRouteSmokeInput = {
  platform: string;
  token?: string;
  buildProfile?: string;
  hostname?: string;
};

export function resolveLocalRouteSmoke({
  platform,
  token,
  buildProfile,
  hostname,
}: LocalRouteSmokeInput) {
  return (
    platform === "web" &&
    token === LOCAL_ROUTE_SMOKE_TOKEN &&
    buildProfile === "local-route-smoke" &&
    (hostname === "localhost" || hostname === "127.0.0.1")
  );
}
