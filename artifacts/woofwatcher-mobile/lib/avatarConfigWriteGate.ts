export interface AvatarConfigWriteSnapshot {
  readonly revision: number;
  readonly pending: boolean;
}

export interface AvatarConfigWriteReservation {
  readonly revision: number;
}

export interface AvatarConfigWriteGate {
  snapshot: () => AvatarConfigWriteSnapshot;
  begin: () => AvatarConfigWriteReservation;
  beginIfCurrent: (
    expectedRevision: number,
  ) => AvatarConfigWriteReservation | null;
  finish: (reservation: AvatarConfigWriteReservation) => boolean;
  invalidate: () => void;
}

export function createAvatarConfigWriteGate(): AvatarConfigWriteGate {
  let revision = 0;
  const activeReservations = new Set<AvatarConfigWriteReservation>();
  const begin = (): AvatarConfigWriteReservation => {
    revision += 1;
    const reservation = { revision };
    activeReservations.add(reservation);
    return reservation;
  };

  return {
    snapshot() {
      return { revision, pending: activeReservations.size > 0 };
    },
    begin,
    beginIfCurrent(expectedRevision) {
      if (revision !== expectedRevision || activeReservations.size > 0) {
        return null;
      }
      return begin();
    },
    finish(reservation) {
      return activeReservations.delete(reservation);
    },
    invalidate() {
      revision += 1;
    },
  };
}
