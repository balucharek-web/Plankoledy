import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  acceptParishInviteInFirestore,
  createParishInviteInFirestore,
  declineParishInviteInFirestore,
  leaveSharedParishInFirestore,
  revokeParishInviteInFirestore,
  subscribeIncomingParishInvites,
  subscribeParishInvitesForOwner,
} from '../services/parishStorage';
import {
  ParishInviteRecord,
  ParishRole,
  SavedParishRecord,
} from '../types/parish';

export interface ParishCollaborationState {
  activeParishRecord: SavedParishRecord | null;
  activeParishRole: ParishRole;
  isCollaborator: boolean;
  assignedPriestId: number | null;
  outgoingInvites: ParishInviteRecord[];
  incomingInvites: ParishInviteRecord[];
  pendingIncomingInvites: ParishInviteRecord[];
  collabBusy: boolean;
  collabError: string | null;
  collabSuccess: string | null;
  clearCollabMessages: () => void;
  inviteCollaborator: (params: {
    email: string;
    priestId: number;
    memberLabel?: string;
  }) => Promise<boolean>;
  acceptInvite: (invite: ParishInviteRecord) => Promise<boolean>;
  declineInvite: (inviteId: string) => Promise<boolean>;
  revokeInvite: (invite: ParishInviteRecord) => Promise<boolean>;
  leaveSharedParish: () => Promise<boolean>;
}

export function useParishCollaboration(params: {
  authUser: User | null;
  savedParishes: SavedParishRecord[];
  activeParishId: string | null;
  onSelectParishId?: (parishId: string) => void;
}): ParishCollaborationState {
  const { authUser, savedParishes, activeParishId, onSelectParishId } = params;

  const [outgoingInvites, setOutgoingInvites] = useState<ParishInviteRecord[]>(
    []
  );
  const [incomingInvites, setIncomingInvites] = useState<ParishInviteRecord[]>(
    []
  );
  const [collabBusy, setCollabBusy] = useState(false);
  const [collabError, setCollabError] = useState<string | null>(null);
  const [collabSuccess, setCollabSuccess] = useState<string | null>(null);

  const clearCollabMessages = useCallback(() => {
    setCollabError(null);
    setCollabSuccess(null);
  }, []);

  const activeParishRecord = useMemo(
    () =>
      activeParishId
        ? savedParishes.find((p) => p.id === activeParishId) ?? null
        : null,
    [savedParishes, activeParishId]
  );

  const activeParishRole: ParishRole = useMemo(() => {
    if (!authUser || !activeParishRecord) return 'proboszcz';
    if (activeParishRecord.userRole) return activeParishRecord.userRole;
    if (
      activeParishRecord.ownerId &&
      activeParishRecord.ownerId !== authUser.uid
    ) {
      return 'wikariusz';
    }
    return 'proboszcz';
  }, [authUser, activeParishRecord]);

  const isCollaborator = activeParishRole === 'wikariusz';

  const authUid = authUser?.uid ?? null;
  const authEmail = authUser?.email?.trim().toLowerCase() ?? '';
  const activeParishIdForSub = activeParishRecord?.id ?? null;

  // Owner subscription: list outgoing invitations for the active parish
  useEffect(() => {
    if (!authUid || !activeParishIdForSub || activeParishRole !== 'proboszcz') {
      setOutgoingInvites([]);
      return;
    }

    const unsubscribe = subscribeParishInvitesForOwner(
      authUid,
      activeParishIdForSub,
      (list) => setOutgoingInvites(list)
    );

    return () => unsubscribe();
  }, [authUid, activeParishIdForSub, activeParishRole]);

  // Verified user subscription: list incoming invitations sent to this user's e-mail
  useEffect(() => {
    if (!authUid || !authEmail) {
      setIncomingInvites([]);
      return;
    }

    const unsubscribe = subscribeIncomingParishInvites(authEmail, (list) =>
      setIncomingInvites(list)
    );

    return () => unsubscribe();
  }, [authUid, authEmail]);

  const pendingIncomingInvites = useMemo(
    () => incomingInvites.filter((inv) => inv.status === 'pending'),
    [incomingInvites]
  );

  const activeCollaboratorInvite = useMemo(() => {
    if (!isCollaborator || !activeParishIdForSub) return null;
    return (
      incomingInvites.find(
        (inv) =>
          inv.parishId === activeParishIdForSub && inv.status === 'accepted'
      ) ?? null
    );
  }, [incomingInvites, isCollaborator, activeParishIdForSub]);

  const assignedPriestId = activeCollaboratorInvite?.priestId ?? null;

  const inviteCollaborator = useCallback(
    async (input: {
      email: string;
      priestId: number;
      memberLabel?: string;
    }): Promise<boolean> => {
      if (!authUser || !activeParishRecord) {
        setCollabError('Zaloguj się i zapisz parafię, aby zaprosić księdza.');
        return false;
      }
      if (activeParishRole !== 'proboszcz') {
        setCollabError('Tylko proboszcz (właściciel parafii) może zapraszać współpracowników.');
        return false;
      }
      const cleanEmail = input.email.trim().toLowerCase();
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        setCollabError('Podaj poprawny adres e-mail księdza.');
        return false;
      }
      if (authEmail && cleanEmail === authEmail) {
        setCollabError('Nie możesz zaprosić własnego adresu e-mail.');
        return false;
      }
      if (
        outgoingInvites.some(
          (inv) => inv.invitedEmail.toLowerCase() === cleanEmail
        )
      ) {
        setCollabError('Ten adres e-mail ma już aktywne zaproszenie do tej parafii.');
        return false;
      }

      setCollabBusy(true);
      setCollabError(null);
      setCollabSuccess(null);
      try {
        await createParishInviteInFirestore({
          ownerUid: authUser.uid,
          ownerEmail: authUser.email,
          parishId: activeParishRecord.id,
          parishName: activeParishRecord.parish.name,
          currentInvitedEmails: activeParishRecord.invitedEmails ?? [],
          invitedEmail: cleanEmail,
          priestId: input.priestId,
          memberLabel: input.memberLabel,
        });
        setCollabSuccess(
          `Wysłano zaproszenie dla ${cleanEmail} (Ksiądz ${input.priestId}). Po zalogowaniu na ten adres zobaczy przycisk dołączenia do parafii.`
        );
        return true;
      } catch (err) {
        const msg =
          err instanceof Error && err.message
            ? err.message
            : 'Nie udało się wysłać zaproszenia.';
        setCollabError(msg);
        return false;
      } finally {
        setCollabBusy(false);
      }
    },
    [authUser, authEmail, activeParishRecord, activeParishRole, outgoingInvites]
  );

  const acceptInvite = useCallback(
    async (invite: ParishInviteRecord): Promise<boolean> => {
      if (!authUser) {
        setCollabError('Zaloguj się, aby zaakceptować zaproszenie.');
        return false;
      }
      setCollabBusy(true);
      setCollabError(null);
      setCollabSuccess(null);
      try {
        await acceptParishInviteInFirestore(authUser.uid, invite);
        setCollabSuccess(
          `Dołączono do parafii ${invite.parishName} jako Wikariusz (Ksiądz ${invite.priestId}).`
        );
        onSelectParishId?.(invite.parishId);
        return true;
      } catch {
        setCollabError(
          'Nie udało się dołączyć do parafii. Upewnij się, że Twój adres e-mail jest potwierdzony.'
        );
        return false;
      } finally {
        setCollabBusy(false);
      }
    },
    [authUser, onSelectParishId]
  );

  const declineInvite = useCallback(
    async (inviteId: string): Promise<boolean> => {
      setCollabBusy(true);
      setCollabError(null);
      setCollabSuccess(null);
      try {
        await declineParishInviteInFirestore(inviteId);
        setCollabSuccess('Zaproszenie zostało odrzucone.');
        return true;
      } catch {
        setCollabError('Nie udało się odrzucić zaproszenia.');
        return false;
      } finally {
        setCollabBusy(false);
      }
    },
    []
  );

  const revokeInvite = useCallback(
    async (invite: ParishInviteRecord): Promise<boolean> => {
      if (!activeParishRecord || activeParishRole !== 'proboszcz') return false;
      setCollabBusy(true);
      setCollabError(null);
      setCollabSuccess(null);
      try {
        await revokeParishInviteInFirestore(
          invite,
          activeParishRecord.invitedEmails ?? [],
          activeParishRecord.memberUids ?? []
        );
        setCollabSuccess(`Cofnięto dostęp dla ${invite.invitedEmail}.`);
        return true;
      } catch {
        setCollabError('Nie udało się cofnąć dostępu.');
        return false;
      } finally {
        setCollabBusy(false);
      }
    },
    [activeParishRecord, activeParishRole]
  );

  const leaveSharedParish = useCallback(async (): Promise<boolean> => {
    if (!authUser || !activeParishRecord || activeParishRole !== 'wikariusz') {
      return false;
    }
    setCollabBusy(true);
    setCollabError(null);
    setCollabSuccess(null);
    try {
      await leaveSharedParishInFirestore(
        authUser.uid,
        activeParishRecord.id,
        activeParishRecord.memberUids ?? [],
        activeCollaboratorInvite?.id
      );
      setCollabSuccess(
        `Opuszczono wspólną parafię ${activeParishRecord.parish.name}.`
      );
      return true;
    } catch {
      setCollabError('Nie udało się opuścić wspólnej parafii.');
      return false;
    } finally {
      setCollabBusy(false);
    }
  }, [
    authUser,
    activeParishRecord,
    activeParishRole,
    activeCollaboratorInvite?.id,
  ]);

  return {
    activeParishRecord,
    activeParishRole,
    isCollaborator,
    assignedPriestId,
    outgoingInvites,
    incomingInvites,
    pendingIncomingInvites,
    collabBusy,
    collabError,
    collabSuccess,
    clearCollabMessages,
    inviteCollaborator,
    acceptInvite,
    declineInvite,
    revokeInvite,
    leaveSharedParish,
  };
}
