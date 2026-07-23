export interface AuthGateOptions {
  isDevelopment: boolean;
  forceInDevelopment?: boolean;
}

export function shouldEnforceAuthGate(options: AuthGateOptions): boolean {
  return !options.isDevelopment || options.forceInDevelopment === true;
}
