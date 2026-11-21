import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  LogOut,
  MailPlus,
  Shield,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { PRIEST_PALETTE, ParishInviteRecord, ParishRole } from '../types/parish';

export interface ParishTeamPanelProps {
  isAuthenticated: boolean;
  userEmail: string | null;
  parishName: string | null;
  activeParishRole: ParishRole;
  assignedPriestId: number | null;
  priestCount: number;
  outgoingInvites: ParishInviteRecord[];
  pendingIncomingInvites: ParishInviteRecord[];
  busy: boolean;
  error: string | null;
  success: string | null;
  onClearMessages: () => void;
  onInviteCollaborator: (params: {
    email: string;
    priestId: number;
    memberLabel?: string;
  }) => Promise<boolean>;
  onAcceptInvite: (invite: ParishInviteRecord) => Promise<boolean>;
  onDeclineInvite: (inviteId: string) => Promise<boolean>;
  onRevokeInvite: (invite: ParishInviteRecord) => Promise<boolean>;
  onLeaveSharedParish: () => Promise<boolean>;
  onOpenAuth?: () => void;
}

export const ParishTeamPanel: React.FC<ParishTeamPanelProps> = ({
  isAuthenticated,
  userEmail,
  parishName,
  activeParishRole,
  assignedPriestId,
  priestCount,
  outgoingInvites,
  pendingIncomingInvites,
  busy,
  error,
  success,
  onClearMessages,
  onInviteCollaborator,
  onAcceptInvite,
  onDeclineInvite,
  onRevokeInvite,
  onLeaveSharedParish,
  onOpenAuth,
}) => {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLabel, setInviteLabel] = useState('');
  const [invitePriestId, setInvitePriestId] = useState<number>(
    Math.min(2, Math.max(1, priestCount))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await onInviteCollaborator({
      email: inviteEmail,
      priestId: invitePriestId,
      memberLabel: inviteLabel.trim() || undefined,
    });
    if (ok) {
      setInviteEmail('');
      setInviteLabel('');
    }
  };

  const priestOptions = PRIEST_PALETTE.slice(0, Math.max(2, priestCount));

  return (
    <div className="p-4 sm:p-5 space-y-5">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-amber-700" />
          <h2 className="text-sm font-semibold text-slate-900">
            Zespół parafialny i role dostępu
          </h2>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Współpracuj z wikariuszami na jednej parafii w czasie rzeczywistym.
          Proboszcz zarządza harmonogramem i adresami, a wikariusze odhaczają
          wizyty i notatki w terenie.
        </p>
      </div>

      {!isAuthenticated ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 space-y-2.5">
          <p className="text-xs text-amber-950 leading-relaxed">
            Zaloguj się na zweryfikowane konto, aby zapraszać innych księży do
            wspólnej parafii lub przyjmować zaproszenia.
          </p>
          {onOpenAuth && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="w-full min-h-[42px] px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors"
            >
              Zaloguj się / Załóż konto
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Current user role card */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                <Shield className="w-3.5 h-3.5 text-amber-700" />
                Twoja rola w tej parafii
              </span>
              <span
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                  activeParishRole === 'proboszcz'
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-emerald-100 text-emerald-900'
                }`}
              >
                {activeParishRole === 'proboszcz' ? 'Proboszcz' : 'Wikariusz'}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {parishName ? (
                <>
                  Aktywna parafia:{' '}
                  <strong className="text-slate-900">{parishName}</strong>
                  {userEmail ? ` (${userEmail})` : ''}.
                </>
              ) : (
                'Wybierz lub utwórz parafię, aby zarządzać zespołem.'
              )}
            </p>
            {activeParishRole === 'wikariusz' && (
              <div className="pt-1.5 space-y-2 border-t border-slate-200/80">
                <p className="text-[11px] text-slate-600 leading-snug">
                  Masz uprawnienia terenowe
                  {assignedPriestId ? ` (przypisany: Ksiądz ${assignedPriestId})` : ''}
                  : możesz przeglądać cały plan i odhaczać wizyty, notatki oraz
                  mieszkania w blokach. Zmiany zapisują się na żywo u proboszcza.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onLeaveSharedParish()}
                  className="min-h-[38px] px-3 py-1.5 text-xs font-medium text-red-700 bg-white hover:bg-red-50 border border-red-200 rounded-xl inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Opuść wspólną parafię</span>
                </button>
              </div>
            )}
          </div>

          {/* Feedback banners */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-900 flex items-start justify-between gap-2">
              <span>{error}</span>
              <button
                type="button"
                onClick={onClearMessages}
                aria-label="Zamknij komunikat"
                className="p-0.5 text-red-700 hover:text-red-900"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {success && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900 flex items-start justify-between gap-2">
              <span>{success}</span>
              <button
                type="button"
                onClick={onClearMessages}
                aria-label="Zamknij komunikat"
                className="p-0.5 text-emerald-700 hover:text-emerald-900"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Pending incoming invitations for current user */}
          {pendingIncomingInvites.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
                Oczekujące zaproszenia ({pendingIncomingInvites.length})
              </h3>
              <div className="space-y-2">
                {pendingIncomingInvites.map((inv) => (
                  <div
                    key={inv.id}
                    className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 space-y-2"
                  >
                    <div className="text-xs">
                      <p className="font-semibold text-slate-900">
                        {inv.parishName}
                      </p>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Rola: Wikariusz · Ksiądz {inv.priestId}
                        {inv.ownerEmail ? ` · od ${inv.ownerEmail}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onAcceptInvite(inv)}
                        className="flex-1 min-h-[40px] px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Dołącz do parafii</span>
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onDeclineInvite(inv.id)}
                        className="min-h-[40px] px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors disabled:opacity-50"
                      >
                        Odrzuć
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Proboszcz invite form & active members list */}
          {activeParishRole === 'proboszcz' && parishName && (
            <div className="space-y-4">
              <form
                onSubmit={(e) => void handleSubmit(e)}
                className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3"
              >
                <div className="flex items-center gap-1.5">
                  <MailPlus className="w-4 h-4 text-amber-700" />
                  <h3 className="text-xs font-semibold text-slate-900">
                    Zaproś wikariusza do parafii
                  </h3>
                </div>

                <div>
                  <label
                    htmlFor="collab-invite-email"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Adres e-mail konta księdza
                  </label>
                  <input
                    id="collab-invite-email"
                    type="email"
                    required
                    placeholder="np. ks.jan@parafia.pl"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 text-base sm:text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label
                      htmlFor="collab-invite-label"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Imię / opis (opcjonalnie)
                    </label>
                    <input
                      id="collab-invite-label"
                      type="text"
                      maxLength={80}
                      placeholder="np. ks. Marek"
                      value={inviteLabel}
                      onChange={(e) => setInviteLabel(e.target.value)}
                      className="w-full min-h-[42px] px-3 py-2 text-base sm:text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="collab-invite-priest"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Przypisana trasa
                    </label>
                    <select
                      id="collab-invite-priest"
                      value={invitePriestId}
                      onChange={(e) =>
                        setInvitePriestId(Number.parseInt(e.target.value, 10))
                      }
                      className="w-full min-h-[42px] px-3 py-2 text-base sm:text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-amber-600"
                    >
                      {priestOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy || !inviteEmail.trim()}
                  className="w-full min-h-[42px] px-3.5 py-2 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 disabled:bg-slate-300 rounded-xl transition-colors"
                >
                  {busy ? 'Wysyłanie zaproszenia...' : 'Wyślij zaproszenie'}
                </button>
              </form>

              {/* List of invited / active collaborators */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-900">
                    Zaproszeni księża ({outgoingInvites.length}/10)
                  </h3>
                </div>

                {outgoingInvites.length === 0 ? (
                  <p className="text-xs text-slate-500 rounded-xl border border-dashed border-slate-200 p-3">
                    Nie zaproszono jeszcze żadnego współpracownika. Po wpisaniu
                    adresu e-mail powyżej wikariusz zobaczy zaproszenie po
                    zalogowaniu.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {outgoingInvites.map((inv) => {
                      const priestColor =
                        PRIEST_PALETTE.find((p) => p.id === inv.priestId)
                          ?.color ?? '#64748b';
                      return (
                        <div
                          key={inv.id}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: priestColor }}
                              />
                              <p className="text-xs font-semibold text-slate-900 truncate">
                                {inv.memberLabel || inv.invitedEmail}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 mt-0.5">
                              {inv.memberLabel && (
                                <span className="truncate">
                                  {inv.invitedEmail}
                                </span>
                              )}
                              <span>Ksiądz {inv.priestId}</span>
                              {inv.status === 'accepted' ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Aktywny
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                                  <Clock className="w-3 h-3" />
                                  Oczekuje
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void onRevokeInvite(inv)}
                            title="Cofnij dostęp"
                            aria-label={`Cofnij dostęp dla ${inv.invitedEmail}`}
                            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
