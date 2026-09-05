export interface AvatarStudioOperationToken<Kind extends string> {
  readonly id: number;
  readonly kind: Kind;
}

export interface AvatarStudioDraftRevision<Draft> {
  readonly draft: Draft;
  readonly version: number;
}

export interface AvatarStudioDraftAuthority<Draft> {
  capture: () => AvatarStudioDraftRevision<Draft>;
  edit: (update: (current: Draft) => Draft) => AvatarStudioDraftRevision<Draft>;
  replace: (draft: Draft) => AvatarStudioDraftRevision<Draft>;
  replaceIfCurrent: (
    captured: AvatarStudioDraftRevision<Draft>,
    draft: Draft,
  ) => AvatarStudioDraftRevision<Draft> | null;
  isCurrent: (captured: AvatarStudioDraftRevision<Draft>) => boolean;
}

export interface AvatarStudioOperationGate<Kind extends string> {
  begin: (kind: Kind) => AvatarStudioOperationToken<Kind> | null;
  finish: (token: AvatarStudioOperationToken<Kind>) => boolean;
  invalidate: () => void;
  isBusy: () => boolean;
  isCurrent: (token: AvatarStudioOperationToken<Kind>) => boolean;
}

export function createAvatarStudioDraftAuthority<Draft>(
  initialDraft: Draft,
): AvatarStudioDraftAuthority<Draft> {
  let current = initialDraft;
  let version = 0;

  const capture = (): AvatarStudioDraftRevision<Draft> => ({
    draft: current,
    version,
  });
  const replace = (draft: Draft): AvatarStudioDraftRevision<Draft> => {
    current = draft;
    version += 1;
    return capture();
  };

  return {
    capture,
    edit(update) {
      return replace(update(current));
    },
    replace,
    replaceIfCurrent(captured, draft) {
      if (captured.version !== version) return null;
      return replace(draft);
    },
    isCurrent(captured) {
      return captured.version === version;
    },
  };
}

export function createAvatarStudioOperationGate<
  Kind extends string,
>(): AvatarStudioOperationGate<Kind> {
  let nextId = 0;
  let active: AvatarStudioOperationToken<Kind> | null = null;

  return {
    begin(kind) {
      if (active) return null;
      const token = { id: (nextId += 1), kind };
      active = token;
      return token;
    },
    finish(token) {
      if (active !== token) return false;
      active = null;
      return true;
    },
    invalidate() {
      active = null;
    },
    isBusy() {
      return active !== null;
    },
    isCurrent(token) {
      return active === token;
    },
  };
}
