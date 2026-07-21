import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Coins,
  Crown,
  Flame,
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  Megaphone,
  RefreshCw,
  Settings,
  Shield,
  Sparkles,
  Table2,
  Users
} from 'lucide-react';
import { hqSections } from '@reemteam/shared';
import './styles.css';

type Operator = { email: string; name: string; role: string };
type Metric = { label: string; value: string | number; tone: string };
type CommandCenter = {
  product: string;
  sentence: string;
  loop: string[];
  metrics: Metric[];
  recommendedActions: GrowthPlay[];
  urgentAlerts: GrowthPlay[];
  bestGrowthMove: GrowthPlay | null;
  systemHealth: string;
};
type User = { id: string; displayName: string; username: string; role: string; status: string; tags: string[]; gamesPlayed: number; wins: number; reems: number; walletSummary?: Record<string, number> };
type Crib = { id: string; cribName: string; description: string; stakeTier: string; status: string; featured: boolean; growthPriority: number };
type TableRecord = { id: string; tableName: string; stake: number; maxSeats: number; status: string; visibility: string; priority: number };
type EventRecord = { id: string; eventName: string; eventType: string; status: string; startTime: string; endTime: string; growthGoal?: string };
type Signal = { id: string; signalType: string; title: string; description: string; severity: string; confidence: number; occurredAt: string; visibilitySafe: boolean };
type GrowthPlay = { id: string; title: string; goal: string; playType: string; recommendedAction: string; recommendedFormat: string; whyItMatters: string; whyThis: { sourceSignals?: string[]; scoreBoosts?: string[]; penalties?: string[]; campaignFit?: string; recommendedActionReason?: string; riskVisibilityNotes?: string[] }; urgency: string; confidence: number; finalScore: number; status: string };
type Draft = { id: string; title: string; format: string; channel: string; caption: string; status: string };
type Health = { status: string; checks: Array<{ component: string; status: string; detail: string }>; counts: Record<string, number> };

const icons = [LayoutDashboard, Users, Table2, Crown, CalendarDays, Activity, Flame, Megaphone, HeartHandshake, Coins, Shield, BarChart3, CheckCircle2, Settings];

const api = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    credentials: 'include'
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(payload.message ?? 'Request failed');
  }
  if (response.status === 204) return null as T;
  return response.json();
};

function App() {
  const [operator, setOperator] = useState<Operator | null>(null);
  const [email, setEmail] = useState('owner@reemteam.local');
  const [password, setPassword] = useState('');
  const [active, setActive] = useState('Command Center');
  const [toast, setToast] = useState('');
  const [commandCenter, setCommandCenter] = useState<CommandCenter | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [cribs, setCribs] = useState<Crib[]>([]);
  const [tables, setTables] = useState<TableRecord[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [growthPlays, setGrowthPlays] = useState<GrowthPlay[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [health, setHealth] = useState<Health | null>(null);

  const refresh = async () => {
    const [command, userRows, cribRows, tableRows, eventRows, signalRows, playRows, draftRows, healthView] = await Promise.all([
      api<CommandCenter>('/hq/command-center'),
      api<User[]>('/hq/users'),
      api<Crib[]>('/hq/cribs'),
      api<TableRecord[]>('/hq/tables'),
      api<EventRecord[]>('/hq/events'),
      api<Signal[]>('/hq/game-intelligence/signals'),
      api<GrowthPlay[]>('/hq/growth-plays'),
      api<Draft[]>('/hq/content-drafts'),
      api<Health>('/hq/system-health')
    ]);
    setCommandCenter(command);
    setUsers(userRows);
    setCribs(cribRows);
    setTables(tableRows);
    setEvents(eventRows);
    setSignals(signalRows);
    setGrowthPlays(playRows);
    setDrafts(draftRows);
    setHealth(healthView);
  };

  useEffect(() => {
    api<{ operator: Operator }>('/auth/me')
      .then((session) => {
        setOperator(session.operator);
        return refresh();
      })
      .catch(() => undefined);
  }, []);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const session = await api<{ operator: Operator }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      setOperator(session.operator);
      setToast('Signed into ReemTeamHQ.');
      await refresh();
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Unable to sign in');
    }
  };

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    setOperator(null);
  };

  const createSeedSignal = async () => {
    const signal = await api<Signal>('/hq/game-intelligence/signals', {
      method: 'POST',
      body: JSON.stringify({
        signalType: 'crib_heating_up_detected',
        sourceType: 'gameplay',
        sourceId: `manual-${Date.now()}`,
        title: 'The Back Room is heating up',
        description: 'Three active games landed in the last hour, including a Reem and one caught drop.',
        occurredAt: new Date().toISOString(),
        severity: 'high',
        confidence: 91,
        visibilitySafe: true
      })
    });
    await api('/hq/growth-plays', { method: 'POST', body: JSON.stringify({ signalId: signal.id, playType: 'crib_promo', activeCampaign: 'promote_high_stake_cribs' }) });
    setToast('Created a fresh Game Intelligence signal and Growth Play.');
    await refresh();
  };

  const approvePlay = async (playId: string) => {
    await api(`/hq/growth-plays/${playId}/approve`, { method: 'POST' });
    setToast('Growth Play approved.');
    await refresh();
  };

  const buildDraft = async (playId: string) => {
    await api(`/hq/growth-plays/${playId}/build-content`, { method: 'POST' });
    setToast('Content Studio draft created.');
    await refresh();
  };

  const dashboardCounts = useMemo(
    () => [
      { label: 'Players', value: users.length, tone: 'green' },
      { label: 'Cribs', value: cribs.length, tone: 'purple' },
      { label: 'Tables', value: tables.length, tone: 'blue' },
      { label: 'Events', value: events.length, tone: 'gold' },
      { label: 'Signals', value: signals.length, tone: 'orange' },
      { label: 'Growth Plays', value: growthPlays.length, tone: 'green' }
    ],
    [users, cribs, tables, events, signals, growthPlays]
  );

  if (!operator) {
    return (
      <main className="login-screen">
        <form className="login-panel" onSubmit={login}>
          <div className="brand-lockup">
            <Crown size={28} />
            <div>
              <strong>ReemTeamHQ</strong>
              <span>Private command center</span>
            </div>
          </div>
          <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button><Shield size={16} /> Sign in</button>
          {toast ? <p className="toast">{toast}</p> : null}
        </form>
      </main>
    );
  }

  return (
    <div className="app">
      {toast ? <div className="toast toast-floating">{toast}</div> : null}
      <aside className="nav">
        <div className="brand-lockup">
          <Crown size={26} />
          <div>
            <strong>ReemTeamHQ</strong>
            <span>{operator.role}</span>
          </div>
        </div>
        <nav>
          {hqSections.map((section, index) => {
            const Icon = icons[index] ?? Sparkles;
            return (
              <button key={section} className={active === section ? 'active' : ''} onClick={() => setActive(section)}>
                <Icon size={17} />
                {section}
              </button>
            );
          })}
        </nav>
        <button className="logout" onClick={logout}><LogOut size={16} /> Sign out</button>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Command center</span>
            <h1>{active}</h1>
            <p>{commandCenter?.sentence ?? 'ReemTeamHQ turns activity into sharper operations and growth moves.'}</p>
          </div>
          <div className="topbar-actions">
            <button onClick={() => void refresh()}><RefreshCw size={16} /> Refresh</button>
            <button className="primary" onClick={() => void createSeedSignal()}><Sparkles size={16} /> Create signal</button>
          </div>
        </header>

        {active === 'Command Center' ? (
          <>
            <section className="metric-grid">
              {(commandCenter?.metrics ?? dashboardCounts).map((metric) => <MetricCard key={metric.label} metric={metric} />)}
            </section>
            <section className="split">
              <Panel title="Today’s Recommended Actions" icon={<Flame size={18} />}>
                <PlayList plays={growthPlays.slice(0, 5)} onApprove={approvePlay} onBuild={buildDraft} />
              </Panel>
              <Panel title="Urgent Admin Alerts" icon={<AlertTriangle size={18} />}>
                <PlayList plays={growthPlays.filter((play) => ['high', 'critical'].includes(play.urgency))} onApprove={approvePlay} onBuild={buildDraft} />
              </Panel>
            </section>
          </>
        ) : null}

        {active === 'Players' ? <Rows title="Players / CRM" rows={users} fields={['displayName', 'username', 'role', 'status', 'tags', 'gamesPlayed', 'wins', 'reems']} /> : null}
        {active === 'Tables' ? <Rows title="Tables" rows={tables} fields={['tableName', 'stake', 'maxSeats', 'status', 'visibility', 'priority']} /> : null}
        {active === 'Cribs' ? <Rows title="Cribs" rows={cribs} fields={['cribName', 'stakeTier', 'status', 'featured', 'growthPriority', 'description']} /> : null}
        {active === 'Events' ? <Rows title="Events" rows={events} fields={['eventName', 'eventType', 'status', 'startTime', 'endTime', 'growthGoal']} /> : null}
        {active === 'Game Intelligence' ? <Rows title="Game Intelligence Signals" rows={signals} fields={['signalType', 'title', 'severity', 'confidence', 'visibilitySafe', 'occurredAt']} /> : null}
        {active === 'Growth Plays' ? <Panel title="Growth Plays Dashboard" icon={<Flame size={18} />}><PlayList plays={growthPlays} onApprove={approvePlay} onBuild={buildDraft} /></Panel> : null}
        {active === 'Content Studio' ? <Rows title="Content Studio Drafts" rows={drafts} fields={['title', 'format', 'channel', 'caption', 'status']} /> : null}
        {active === 'System Health' ? <Rows title="System Health" rows={health?.checks ?? []} fields={['component', 'status', 'detail']} /> : null}
        {!['Command Center', 'Players', 'Tables', 'Cribs', 'Events', 'Game Intelligence', 'Growth Plays', 'Content Studio', 'System Health'].includes(active) ? (
          <Panel title={active} icon={<ClipboardList size={18} />}>
            <div className="empty">This module has a clean route and product slot. The next pass fills its operator workflows without old RGE code.</div>
          </Panel>
        ) : null}
      </main>
    </div>
  );
}

function MetricCard({ metric }: { metric: Metric }) {
  return (
    <article className={`metric metric-${metric.tone}`}>
      <span>{metric.label}</span>
      <strong>{metric.value}</strong>
    </article>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-header">{icon}<h2>{title}</h2></div>
      {children}
    </section>
  );
}

function PlayList({ plays, onApprove, onBuild }: { plays: GrowthPlay[]; onApprove: (id: string) => Promise<void>; onBuild: (id: string) => Promise<void> }) {
  if (!plays.length) return <div className="empty">No Growth Plays yet. Create a signal to let HQ recommend a move.</div>;
  return (
    <div className="play-list">
      {plays.map((play) => (
        <article className="play-card" key={play.id}>
          <div className="play-card-top">
            <span>{play.playType}</span>
            <span>{play.urgency}</span>
            <strong>{Math.round(play.finalScore)}</strong>
          </div>
          <h3>{play.title}</h3>
          <p>{play.whyItMatters}</p>
          <div className="why-box">
            <strong>Why this?</strong>
            <span>{play.whyThis?.campaignFit ?? 'HQ ranked this from current signals.'}</span>
          </div>
          <div className="row-actions">
            <button onClick={() => void onApprove(play.id)}><CheckCircle2 size={15} /> Approve</button>
            <button className="primary" onClick={() => void onBuild(play.id)}><Megaphone size={15} /> Build content</button>
          </div>
        </article>
      ))}
    </div>
  );
}

function Rows({ title, rows, fields }: { title: string; rows: Array<Record<string, any>>; fields: string[] }) {
  return (
    <Panel title={title} icon={<ClipboardList size={18} />}>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>{fields.map((field) => <th key={field}>{field}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id ?? JSON.stringify(row)}>
                {fields.map((field) => <td key={field}>{Array.isArray(row[field]) ? row[field].join(', ') : String(row[field] ?? '')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length ? <div className="empty">No records yet.</div> : null}
    </Panel>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
