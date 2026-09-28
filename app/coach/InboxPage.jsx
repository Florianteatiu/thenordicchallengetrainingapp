import { useMemo } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ClipboardCheck, Mic } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { listCheckins, listClients, listRecentCheckinsAll } from "../lib/api";
import { addDays, formatDateTime, todayISO } from "../lib/dates";
import { useConversations } from "../lib/useUnread";
import { Avatar, ErrorBox, PageLoader, Spinner, useAsync } from "../components/ui";
import Chat from "../components/Chat";
import { CheckinCard } from "../components/Checkins";

export function ClientCheckins({ clientId }) {
  const { data, loading, error, reload, setData } = useAsync(() => listCheckins(clientId), [clientId]);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data.length) return <div className="empty small">No check-ins yet. Clients are prompted every Friday to Monday.</div>;
  return (
    <div className="list">
      {data.map((c) => (
        <CheckinCard key={c.id} checkin={c} coach onReplied={(saved) => setData((list) => list.map((x) => (x.id === saved.id ? saved : x)))} />
      ))}
    </div>
  );
}

function Thread({ client }) {
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "checkins" ? "checkins" : "chat";
  return (
    <div className="col gap-12">
      <div className="row between">
        <Link to={`/coach/clients/${client.id}`} className="row">
          <Avatar name={client.full_name} url={client.avatar_url} size={40} />
          <div>
            <div className="h3">{client.full_name}</div>
            <div className="tiny faint">Open profile</div>
          </div>
        </Link>
      </div>
      <div className="tabs" style={{ marginBottom: 0 }}>
        <button className={tab === "chat" ? "active" : ""} onClick={() => setParams({})}>
          Chat
        </button>
        <button className={tab === "checkins" ? "active" : ""} onClick={() => setParams({ tab: "checkins" })}>
          Check-ins
        </button>
      </div>
      {tab === "chat" ? (
        <Chat clientId={client.id} me={profile} other={client} className="chat-embedded" emptyText={`No messages with ${client.full_name} yet. Say hi!`} />
      ) : (
        <ClientCheckins clientId={client.id} />
      )}
    </div>
  );
}

export default function InboxPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const conversations = useConversations();
  const { data, loading, error, reload } = useAsync(async () => {
    const [clients, checkins] = await Promise.all([listClients(), listRecentCheckinsAll(addDays(todayISO(), -28))]);
    return { clients, checkins };
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.clients
      .filter((c) => !c.archived || conversations[c.id])
      .map((c) => ({
        client: c,
        conv: conversations[c.id],
        awaiting: data.checkins.filter((ci) => ci.client_id === c.id && !ci.coach_reply).length,
      }))
      .sort((a, b) => {
        const score = (r) => (r.conv?.unread || r.awaiting ? 1 : 0);
        if (score(a) !== score(b)) return score(b) - score(a);
        return (b.conv?.last.created_at ?? "").localeCompare(a.conv?.last.created_at ?? "");
      });
  }, [data, conversations]);

  if (loading && !data) return <PageLoader />;
  const active = rows.find((r) => r.client.id === clientId);

  return (
    <div className={`inbox${clientId ? " has-thread" : ""}`}>
      <div className="inbox-list">
        <div className="page-head">
          <div>
            <div className="eyebrow">Coach</div>
            <h1 className="h1 mt-4">Inbox</h1>
          </div>
        </div>
        <ErrorBox error={error} onRetry={reload} />
        {rows.length === 0 ? (
          <div className="empty small">When clients sign up, their conversations show up here.</div>
        ) : (
          <div className="list">
            {rows.map(({ client, conv, awaiting }) => (
              <button
                key={client.id}
                className={`card card-tight card-link row inbox-row${client.id === clientId ? " selected" : ""}`}
                onClick={() => navigate(`/coach/inbox/${client.id}${awaiting && !conv?.unread ? "?tab=checkins" : ""}`)}
              >
                <Avatar name={client.full_name} url={client.avatar_url} size={40} />
                <div className="grow" style={{ minWidth: 0, textAlign: "left" }}>
                  <div className="row between">
                    <span style={{ fontWeight: conv?.unread ? 800 : 700 }} className="ellipsis">
                      {client.full_name}
                    </span>
                    {conv && <span className="tiny faint nowrap">{formatDateTime(conv.last.created_at)}</span>}
                  </div>
                  <div className="row between gap-6">
                    <span className={`small ellipsis ${conv?.unread ? "" : "muted"}`}>
                      {conv ? (
                        <>
                          {conv.last.sender_id !== client.id && "You: "}
                          {conv.last.audio_path && !conv.last.body ? (
                            <span className="row gap-4" style={{ display: "inline-flex" }}>
                              <Mic size={13} /> Voice note
                            </span>
                          ) : (
                            conv.last.body
                          )}
                        </>
                      ) : (
                        <span className="faint">No messages yet</span>
                      )}
                    </span>
                    <span className="row gap-4">
                      {awaiting > 0 && (
                        <span className="pill pill-yellow" title="Check-in waiting for your reply">
                          <ClipboardCheck size={12} />
                        </span>
                      )}
                      {conv?.unread > 0 && <span className="nav-badge">{conv.unread}</span>}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="inbox-thread">
        {clientId && (
          <Link to="/coach/inbox" className="row small muted mb-12 inbox-back" style={{ gap: 4 }}>
            <ArrowLeft size={15} /> Inbox
          </Link>
        )}
        {active ? (
          <Thread key={active.client.id} client={active.client} />
        ) : (
          <div className="empty small inbox-placeholder">Pick a client to read and reply.</div>
        )}
      </div>
    </div>
  );
}
