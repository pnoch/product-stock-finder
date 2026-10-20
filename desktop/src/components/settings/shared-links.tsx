import { useState } from "react";
import { Link } from "react-router";
import { useToast } from "../../hooks/use-toast";
import { trpc } from "../../lib/trpc";
import { LoadingSpinner } from "../LoadingSpinner";

export type SharedLink = {
  token: string;
  title: string;
  shareUrl: string;
  expiresAt: string | null;
  membersOnly: boolean;
};

export function SharedLinksList() {
  const { showToast } = useToast();
  const listQuery = trpc.sharedWatchlists.list.useQuery();
  const extendMutation = trpc.sharedWatchlists.extend.useMutation();
  const revokeMutation = trpc.sharedWatchlists.revoke.useMutation();
  const membersOnlyMutation = trpc.sharedWatchlists.setMembersOnly.useMutation();
  const [busyToken, setBusyToken] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const links = ((listQuery.data?.links ?? []) as SharedLink[]);

  const setMembersOnly = async (token: string, next: boolean) => {
    if (busyToken) return;
    setBusyToken(token);
    try {
      await membersOnlyMutation.mutateAsync({ token, membersOnly: next });
      await listQuery.refetch();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyToken(null);
    }
  };

  const runFor = async (token: string, action: "copy" | "extend" | "revoke") => {
    if (busyToken) return;
    if (action === "copy") {
      const link = links.find((l) => l.token === token);
      if (!link) return;
      try {
        await navigator.clipboard.writeText(link.shareUrl);
        showToast("Copied");
      } catch {
        showToast("Couldn't copy link");
      }
      return;
    }
    setBusyToken(token);
    try {
      if (action === "extend") {
        const res = await extendMutation.mutateAsync({ token });
        await listQuery.refetch();
        showToast(`Extended to ${new Date(res.expiresAt).toLocaleDateString()}`);
      } else {
        await revokeMutation.mutateAsync({ token });
        await listQuery.refetch();
        showToast("Link revoked");
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyToken(null);
    }
  };

  if (listQuery.isLoading) return <LoadingSpinner />;
  if (listQuery.isError || links.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      {links.map((link) => {
        const busy = busyToken === link.token;
        const expired = link.expiresAt ? new Date(link.expiresAt).getTime() < now : false;
        return (
          <div key={link.token} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
            <p className="text-sm font-semibold truncate">{link.title}</p>
            <p className={`text-xs mt-0.5 ${expired ? "text-red-500" : "text-gray-500"}`}>
              {link.expiresAt ? `${expired ? "Expired" : "Expires"} ${new Date(link.expiresAt).toLocaleDateString()}` : "No expiry"}
            </p>
            <div className="flex gap-2 mt-2">
              {([["copy", "Copy"], ["extend", "Extend 30d"], ["revoke", "Revoke"]] as const).map(([action, label]) => (
                <button
                  key={action}
                  onClick={() => void runFor(link.token, action)}
                  disabled={busy}
                  aria-label={`${label} share link ${link.title}`}
                  className={`text-xs px-2 py-1 rounded border bg-white dark:bg-gray-800 disabled:opacity-50 ${action === "revoke" ? "text-red-500" : "text-brand-600"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {!expired && (
              <SharedLinkMembers
                token={link.token}
                membersOnly={link.membersOnly}
                onToggleMembersOnly={(next) => void setMembersOnly(link.token, next)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Owner-side member roster + invite-by-email for one share link.
function SharedLinkMembers({
  token,
  membersOnly,
  onToggleMembersOnly,
}: {
  token: string;
  membersOnly: boolean;
  onToggleMembersOnly: (next: boolean) => void;
}) {
  const { showToast } = useToast();
  const membersQuery = trpc.sharedWatchlists.members.useQuery({ token });
  const inviteMutation = trpc.sharedWatchlists.inviteByEmail.useMutation();
  const removeMutation = trpc.sharedWatchlists.removeMember.useMutation();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const members = membersQuery.data?.members ?? [];

  const invite = async () => {
    if (!email.trim() || busy) return;
    setBusy(true);
    try {
      const res = await inviteMutation.mutateAsync({ token, email: email.trim() });
      await membersQuery.refetch();
      setEmail("");
      showToast(`Invited ${res.name}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (userId: number) => {
    if (busy) return;
    setBusy(true);
    try {
      await removeMutation.mutateAsync({ token, userId });
      await membersQuery.refetch();
      showToast("Member removed");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 space-y-1">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={membersOnly}
          onChange={(e) => onToggleMembersOnly(e.target.checked)}
          aria-label="Members only"
        />
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Members only (the link alone won&apos;t work)
        </span>
      </label>
      {members.map((m) => {
        const label = m.name ?? m.email ?? `User ${m.userId}`;
        return (
          <div key={m.userId} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 flex-1 truncate">{label}</span>
            <button
              onClick={() => void removeMember(m.userId)}
              disabled={busy}
              aria-label={`Remove ${label}`}
              className="text-xs text-red-500 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        );
      })}
      {members.length === 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400">No members yet</p>
      )}
      <div className="flex items-center gap-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Invite by email"
          type="email"
          aria-label="Invite member by email"
          className="flex-1 text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
        />
        <button
          onClick={() => void invite()}
          disabled={busy || !email.trim()}
          aria-label="Send invite"
          className="text-xs px-2 py-1 rounded border bg-white dark:bg-gray-800 text-brand-600 disabled:opacity-50"
        >
          Invite
        </button>
      </div>
    </div>
  );
}

// Shares the signed-in user was invited to / joined ("Shared with me").
export function JoinedSharedList() {
  const { showToast } = useToast();
  const joinedQuery = trpc.sharedWatchlists.listJoined.useQuery();
  const leaveMutation = trpc.sharedWatchlists.leave.useMutation();
  const [busy, setBusy] = useState(false);
  const shares = joinedQuery.data?.shares ?? [];

  if (joinedQuery.isLoading || shares.length === 0) return null;

  const leave = async (token: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await leaveMutation.mutateAsync({ token });
      await joinedQuery.refetch();
      showToast("Left shared watchlist");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Leave failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      {shares.map((s) => (
        <div
          key={s.token}
          className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600"
        >
          <p className="text-sm font-semibold truncate">{s.title}</p>
          <p className="text-xs mt-0.5 text-gray-500 dark:text-gray-400 truncate">
            Shared by {s.ownerName ?? "another user"}
            {s.membersOnly ? " · members only" : ""}
          </p>
          <div className="flex gap-2 mt-2">
            <Link
              to={`/w/${s.token}`}
              aria-label={`Open ${s.title}`}
              className="text-xs px-2 py-1 rounded border bg-white dark:bg-gray-800 text-brand-600"
            >
              Open
            </Link>
            <button
              onClick={() => void leave(s.token)}
              disabled={busy}
              aria-label={`Leave ${s.title}`}
              className="text-xs px-2 py-1 rounded border bg-white dark:bg-gray-800 text-red-500 disabled:opacity-50"
            >
              Leave
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

