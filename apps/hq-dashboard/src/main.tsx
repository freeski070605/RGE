import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
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
  Save,
  Settings,
  Shield,
  Sparkles,
  Table2,
  Target,
  Users
} from 'lucide-react';
import { hqSections } from '@reemteam/shared';
import './styles.css';

type AnyRow = Record<string, any>;
type Operator = { email: string; name: string; role: string };
type Health = { status: string; checks: AnyRow[]; counts: Record<string, number>; database?: AnyRow };
type CommandCenter = { sentence: string; metrics: AnyRow[]; recommendedActions: AnyRow[]; urgentAlerts: AnyRow[]; systemHealth: string };
type SortDirection = 'asc' | 'desc';
type SortState = { field: string; direction: SortDirection } | null;

const nav = hqSections;
const sectionIcons: Record<string, React.ComponentType<{ size?: number }>> = {
  'Command Center': LayoutDashboard,
  'Account Management': Users,
  Tables: Table2,
  Cribs: Crown,
  Events: CalendarDays,
  Campaigns: Target,
  'Game Intelligence': Activity,
  'Growth Plays': Flame,
  'Content Studio': Megaphone,
  Referrals: HeartHandshake,
  Support: Shield,
  Analytics: BarChart3,
  'System Health': CheckCircle2,
  Settings
};

const defaults: Record<string, AnyRow> = {
  Tables: { tableName: '', cribId: '', stake: 5, maxSeats: 4, status: 'open', visibility: 'public' },
  Cribs: { cribName: '', description: '', stakeTier: 'low', theme: 'classic', status: 'active', growthPriority: 50, eventEligible: true },
  Events: { eventName: '', eventType: 'reem_chase', description: '', startTime: localDate(1), endTime: localDate(4), status: 'scheduled', contentGoal: '', growthGoal: '' },
  Campaigns: { campaignName: '', campaignType: 'promote_friday_night_reem', description: '', priority: 50, status: 'draft' },
  'Game Intelligence': { signalType: 'reem_detected', sourceType: 'gameplay', sourceId: `manual-${Date.now()}`, title: '', description: '', occurredAt: new Date().toISOString(), severity: 'high', confidence: 90, visibilitySafe: true },
  'Content Studio': { title: '', format: 'IG Story', channel: 'Content Studio', caption: '', hook: '', overlayText: '', cta: 'Join the action', status: 'draft' },
  Referrals: { ownerUserId: '', code: '', status: 'active', rewardAmount: 0 },
  Support: { userId: '', title: '', severity: 'medium', status: 'open', notes: [] },
  Analytics: { channel: 'IG Story', format: 'Leaderboard card', metric: 'table_joins', value: 0, learning: '' },
  Settings: { automationMode: 'assisted', approvedChannels: ['Content Studio', 'In-app banner', 'Push notification'], approvedFormats: ['IG Story', 'Leaderboard card', 'Referral promo'], activeCampaign: '' }
};

const endpoints: Record<string, string> = {
  'Account Management': '/hq/users',
  Tables: '/hq/tables',
  Cribs: '/hq/cribs',
  Events: '/hq/events',
  Campaigns: '/hq/campaigns',
  'Game Intelligence': '/hq/game-intelligence/signals',
  'Growth Plays': '/hq/growth-plays',
  'Content Studio': '/hq/content-drafts',
  Referrals: '/hq/referrals',
  Support: '/hq/support',
  Analytics: '/hq/analytics',
  'System Health': '/hq/system-health',
  Settings: '/hq/settings'
};

const fields: Record<string, string[]> = {
  'Account Management': ['displayName', 'username', 'usdBalance', 'rtcBalance', 'gamesPlayed', 'wins', 'reems', 'winRate', 'isVip', 'status'],
  Tables: ['tableName', 'stake', 'maxSeats', 'status', 'visibility', 'priority', 'featured'],
  Cribs: ['cribName', 'stakeTier', 'status', 'featured', 'growthPriority', 'description'],
  Events: ['eventName', 'eventType', 'status', 'startTime', 'endTime', 'growthGoal'],
  Campaigns: ['campaignName', 'campaignType', 'status', 'priority', 'description'],
  'Game Intelligence': ['signalType', 'title', 'severity', 'confidence', 'visibilitySafe', 'status'],
  'Growth Plays': ['title', 'playType', 'urgency', 'finalScore', 'status', 'recommendedAction'],
  'Content Studio': ['title', 'format', 'channel', 'caption', 'status', 'scheduledFor'],
  Referrals: ['code', 'ownerUserId', 'invitedUserId', 'status', 'rewardAmount', 'abuseFlags'],
  Support: ['title', 'userId', 'severity', 'status', 'notes'],
  Analytics: ['learning', 'channel', 'format', 'metric', 'value'],
  'System Health': ['component', 'status', 'detail'],
  Settings: ['automationMode', 'approvedChannels', 'approvedFormats', 'activeCampaign']
};

function localDate(hours: number) {
  const date = new Date(Date.now() + hours * 60 * 60 * 1000);
  return date.toISOString().slice(0, 16);
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
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
}

function App() {
  const [operator, setOperator] = useState<Operator | null>(null);
  const [email, setEmail] = useState('owner@reemteam.local');
  const [password, setPassword] = useState('');
  const [active, setActive] = useState<string>('Command Center');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [commandCenter, setCommandCenter] = useState<CommandCenter | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [data, setData] = useState<Record<string, any>>({});
  const [draft, setDraft] = useState<Record<string, AnyRow>>(() => ({ ...defaults }));
  const [selected, setSelected] = useState<AnyRow | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [command, systemHealth] = await Promise.all([api<CommandCenter>('/hq/command-center'), api<Health>('/hq/system-health')]);
      const next: Record<string, any> = {};
      await Promise.all(
        Object.entries(endpoints).map(async ([key, endpoint]) => {
          if (key === 'System Health') return;
          if (key === 'Settings') {
            next[key] = await api(endpoint);
            return;
          }
          if (key === 'Analytics') {
            const analytics = await api<any>(endpoint);
            next[key] = analytics.results ?? [];
            next.whatWorked = await api('/hq/analytics/what-worked');
            return;
          }
          next[key] = await api(endpoint);
        })
      );
      setCommandCenter(command);
      setHealth(systemHealth);
      next['System Health'] = systemHealth.checks ?? [];
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load ReemTeamHQ data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api<{ operator: Operator }>('/auth/me')
      .then((session) => {
        setOperator(session.operator);
        return loadAll();
      })
      .catch(() => undefined);
  }, []);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const session = await api<{ operator: Operator }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      setOperator(session.operator);
      setToast('Signed into ReemTeamHQ.');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    }
  };

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    setOperator(null);
  };

  const submit = async (page: string) => {
    const body = normalizePayload(draft[page] ?? {});
    const endpoint = page === 'Analytics' ? '/hq/analytics/performance-results' : endpoints[page];
    const method = page === 'Settings' ? 'PATCH' : 'POST';
    await run(async () => {
      await api(endpoint, { method, body: JSON.stringify(body) });
      setToast(`${page} saved.`);
      setDraft((current) => ({ ...current, [page]: { ...(defaults[page] ?? {}) } }));
      await loadAll();
    });
  };

  const run = async (fn: () => Promise<void>) => {
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const pageRows = useMemo(() => (active === 'Settings' ? [data.Settings ?? {}] : active === 'System Health' ? health?.checks ?? [] : data[active] ?? []), [active, data, health]);

  if (!operator) {
    return (
      <main className="login-screen">
        <form className="login-panel" onSubmit={login}>
          <div className="brand-lockup"><Crown size={28} /><div><strong>ReemTeamHQ</strong><span>Private command center</span></div></div>
          <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button><Shield size={16} /> Sign in</button>
          {error ? <p className="toast">{error}</p> : null}
        </form>
      </main>
    );
  }

  return (
    <div className="app">
      {toast ? <div className="toast toast-floating" onAnimationEnd={() => setToast('')}>{toast}</div> : null}
      <aside className="nav">
        <div className="brand-lockup"><Crown size={26} /><div><strong>ReemTeamHQ</strong><span>{operator.role}</span></div></div>
        <nav>
          {nav.map((section) => {
            const Icon = sectionIcons[section] ?? Sparkles;
            const count = Array.isArray(data[section]) ? data[section].length : section === 'System Health' ? health?.checks.length ?? 0 : undefined;
            return <button key={section} className={active === section ? 'active' : ''} onClick={() => { setActive(section); setSelected(null); }}><Icon size={17} />{section}{count != null ? <small>{count}</small> : null}</button>;
          })}
        </nav>
        <button className="logout" onClick={logout}><LogOut size={16} /> Sign out</button>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div><span className="eyebrow">ReemTeamHQ</span><h1>{active}</h1><p>{commandCenter?.sentence ?? 'Run ReemTeam from one private command center.'}</p></div>
          <div className="topbar-actions">
            <button onClick={() => void loadAll()}><RefreshCw size={16} /> Refresh</button>
            <button className="primary" onClick={() => void run(async () => { await api('/hq/game-intelligence/run', { method: 'POST' }); setToast('Intelligence run complete.'); await loadAll(); })}><Sparkles size={16} /> Run intelligence</button>
          </div>
        </header>
        {error ? <div className="error-state">{error}</div> : null}
        {loading ? <div className="empty">Loading live HQ data...</div> : null}
        {active === 'Command Center' ? <CommandCenterView commandCenter={commandCenter} growthPlays={data['Growth Plays'] ?? []} health={health} run={run} loadAll={loadAll} /> : null}
        {active !== 'Command Center' ? (
          <Page
            title={active}
            rows={pageRows}
            fields={fields[active] ?? []}
            draft={draft[active] ?? {}}
            setDraft={(value) => setDraft((current) => ({ ...current, [active]: value }))}
            onSubmit={() => submit(active)}
            selected={selected}
            setSelected={setSelected}
            run={run}
            loadAll={loadAll}
          />
        ) : null}
      </main>
    </div>
  );
}

function normalizePayload(input: AnyRow) {
  const output: AnyRow = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === '') continue;
    if (Array.isArray(value)) output[key] = value;
    else if (typeof value === 'string' && value.includes(',') && ['tags', 'approvedChannels', 'approvedFormats', 'notes', 'abuseFlags'].includes(key)) output[key] = value.split(',').map((part) => part.trim()).filter(Boolean);
    else if (['stake', 'maxSeats', 'priority', 'growthPriority', 'confidence', 'rewardAmount', 'amount', 'value'].includes(key)) output[key] = Number(value);
    else if (['featured', 'eventEligible', 'visibilitySafe'].includes(key)) output[key] = value === true || value === 'true';
    else output[key] = value;
  }
  return output;
}

function CommandCenterView({ commandCenter, growthPlays, health, run, loadAll }: { commandCenter: CommandCenter | null; growthPlays: AnyRow[]; health: Health | null; run: (fn: () => Promise<void>) => Promise<void>; loadAll: () => Promise<void> }) {
  return (
    <>
      <section className="metric-grid">{(commandCenter?.metrics ?? []).map((metric) => <MetricCard key={metric.label} metric={metric} />)}</section>
      <section className="split">
        <Panel title="Recommended Actions" icon={<Flame size={18} />}>
          <PlayList plays={growthPlays.slice(0, 6)} run={run} loadAll={loadAll} />
        </Panel>
        <Panel title="System Health" icon={<AlertTriangle size={18} />}>
          <Rows rows={health?.checks ?? []} fields={['component', 'status', 'detail']} onSelect={() => undefined} />
        </Panel>
      </section>
    </>
  );
}

function Page(input: {
  title: string;
  rows: AnyRow[];
  fields: string[];
  draft: AnyRow;
  setDraft: (value: AnyRow) => void;
  onSubmit: () => Promise<void>;
  selected: AnyRow | null;
  setSelected: (row: AnyRow | null) => void;
  run: (fn: () => Promise<void>) => Promise<void>;
  loadAll: () => Promise<void>;
}) {
  const canCreate = Boolean(defaults[input.title]);
  return (
    <section className="page-grid">
      <Panel title={`${input.title} Records`} icon={<ClipboardList size={18} />}>
        <Rows rows={input.rows} fields={input.fields} onSelect={input.setSelected} sortable={input.title === 'Account Management'} />
        {!input.rows.length ? <div className="empty">No {input.title.toLowerCase()} records loaded yet.</div> : null}
      </Panel>
      <aside className="side-panel">
        {canCreate ? <Editor page={input.title} value={input.draft} setValue={input.setDraft} onSubmit={input.onSubmit} /> : null}
        {input.selected ? <Detail page={input.title} row={input.selected} run={input.run} loadAll={input.loadAll} /> : null}
      </aside>
    </section>
  );
}

function Editor({ page, value, setValue, onSubmit }: { page: string; value: AnyRow; setValue: (value: AnyRow) => void; onSubmit: () => Promise<void> }) {
  return (
    <form className="panel form-panel" onSubmit={(event) => { event.preventDefault(); void onSubmit(); }}>
      <div className="panel-header"><Sparkles size={18} /><h2>{page === 'Analytics' ? 'Record Result' : page === 'Settings' ? 'Save Settings' : `Create ${page}`}</h2></div>
      {Object.entries(value).map(([key, fieldValue]) => (
        <label key={key}>{key}<input value={Array.isArray(fieldValue) ? fieldValue.join(', ') : String(fieldValue ?? '')} onChange={(event) => setValue({ ...value, [key]: event.target.value })} /></label>
      ))}
      <button className="primary"><CheckCircle2 size={16} /> Save</button>
    </form>
  );
}

function Detail({ page, row, run, loadAll }: { page: string; row: AnyRow; run: (fn: () => Promise<void>) => Promise<void>; loadAll: () => Promise<void> }) {
  const endpoint = endpoints[page];
  const action = async (path: string, method = 'POST', body?: AnyRow) => {
    await run(async () => {
      await api(path, { method, body: body ? JSON.stringify(body) : undefined });
      await loadAll();
    });
  };
  return (
    <Panel title="Selected Detail" icon={<Activity size={18} />}>
      <pre className="detail-json">{JSON.stringify(row, null, 2)}</pre>
      <div className="row-actions">
        {page === 'Tables' ? <><button onClick={() => void action(`${endpoint}/${row.id}/pause`)}>Pause</button><button onClick={() => void action(`${endpoint}/${row.id}/feature`)}>Feature</button></> : null}
        {page === 'Cribs' ? <button onClick={() => void action(`${endpoint}/${row.id}/feature`)}>Feature</button> : null}
        {page === 'Events' ? <><button onClick={() => void action(`${endpoint}/${row.id}/start`)}>Start</button><button onClick={() => void action(`${endpoint}/${row.id}/pause`)}>Pause</button><button onClick={() => void action(`${endpoint}/${row.id}/end`)}>End</button></> : null}
        {page === 'Campaigns' ? <><button onClick={() => void action(`${endpoint}/${row.id}/activate`)}>Activate</button><button onClick={() => void action(`${endpoint}/${row.id}/deactivate`)}>Deactivate</button></> : null}
        {page === 'Growth Plays' ? <><button onClick={() => void action(`${endpoint}/${row.id}/approve`)}>Approve</button><button onClick={() => void action(`${endpoint}/${row.id}/dismiss`)}>Dismiss</button><button className="primary" onClick={() => void action(`${endpoint}/${row.id}/build-content`)}>Build Content</button></> : null}
        {page === 'Content Studio' ? <><button onClick={() => void action(`${endpoint}/${row.id}/approve`)}>Approve</button><button onClick={() => void action(`${endpoint}/${row.id}/schedule`, 'POST', { scheduledFor: localDate(2) })}>Schedule</button><button className="primary" onClick={() => void action(`${endpoint}/${row.id}/publish-now`)}>Publish Now</button></> : null}
        {page === 'Account Management' ? <><button onClick={() => void action(`${endpoint}/${row.id}/ban`, 'POST', { isBanned: !row.isBanned })}>{row.isBanned ? 'Unban' : 'Ban'}</button><button onClick={() => void action(`${endpoint}/${row.id}/freeze`, 'POST', { isFrozen: !row.isFrozen })}>{row.isFrozen ? 'Unfreeze' : 'Freeze'}</button><button onClick={() => void action(`${endpoint}/${row.id}/vip`, 'POST', { isVip: !row.isVip })}>{row.isVip ? 'Remove VIP' : 'Make VIP'}</button></> : null}
        {page === 'Support' ? <button className="primary" onClick={() => void action(`${endpoint}/${row.id}/resolve`)}>Resolve</button> : null}
      </div>
      {page === 'Account Management' ? <WalletAdjustment row={row} run={run} loadAll={loadAll} /> : null}
    </Panel>
  );
}

function WalletAdjustment({ row, run, loadAll }: { row: AnyRow; run: (fn: () => Promise<void>) => Promise<void>; loadAll: () => Promise<void> }) {
  const [draft, setDraft] = useState({ amount: '', currency: 'RTC', reason: '' });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await run(async () => {
      await api('/hq/wallet/adjust', {
        method: 'POST',
        body: JSON.stringify({
          userId: row.id,
          amount: Number(draft.amount),
          currency: draft.currency,
          reason: draft.reason
        })
      });
      setDraft({ amount: '', currency: 'RTC', reason: '' });
      await loadAll();
    });
  };

  return (
    <form className="inline-form" onSubmit={submit}>
      <label>amount<input value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} placeholder="e.g. 5000 or -1000" /></label>
      <label>currency<input value={draft.currency} onChange={(event) => setDraft({ ...draft, currency: event.target.value.toUpperCase() })} /></label>
      <label>reason<input value={draft.reason} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} placeholder="Adjustment reason" /></label>
      <button className="primary"><Save size={16} /> Apply wallet adjustment</button>
    </form>
  );
}

function MetricCard({ metric }: { metric: AnyRow }) {
  return <article className={`metric metric-${metric.tone ?? 'blue'}`}><span>{metric.label}</span><strong>{String(metric.value)}</strong></article>;
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="panel"><div className="panel-header">{icon}<h2>{title}</h2></div>{children}</section>;
}

function PlayList({ plays, run, loadAll }: { plays: AnyRow[]; run: (fn: () => Promise<void>) => Promise<void>; loadAll: () => Promise<void> }) {
  if (!plays.length) return <div className="empty">No Growth Plays yet. Run intelligence or create Game Intelligence signals.</div>;
  return <div className="play-list">{plays.map((play) => <article className="play-card" key={play.id}><div className="play-card-top"><span>{play.playType}</span><span>{play.urgency}</span><strong>{Math.round(play.finalScore ?? 0)}</strong></div><h3>{play.title}</h3><p>{play.whyItMatters}</p><div className="why-box"><strong>Why this?</strong><span>{play.whyThis?.campaignFit ?? 'HQ ranked this from current signals.'}</span></div><div className="row-actions"><button onClick={() => void run(async () => { await api(`/hq/growth-plays/${play.id}/approve`, { method: 'POST' }); await loadAll(); })}>Approve</button><button className="primary" onClick={() => void run(async () => { await api(`/hq/growth-plays/${play.id}/build-content`, { method: 'POST' }); await loadAll(); })}>Build content</button></div></article>)}</div>;
}

function Rows({ rows, fields, onSelect, sortable = false }: { rows: AnyRow[]; fields: string[]; onSelect: (row: AnyRow) => void; sortable?: boolean }) {
  const [sort, setSort] = useState<SortState>(null);
  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((left, right) => compareValues(fieldValue(left, sort.field), fieldValue(right, sort.field), sort.direction));
  }, [rows, sort]);
  const changeSort = (field: string) => {
    if (!sortable) return;
    setSort((current) => {
      if (!current || current.field !== field) return { field, direction: 'asc' };
      if (current.direction === 'asc') return { field, direction: 'desc' };
      return null;
    });
  };

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {fields.map((field) => {
              const active = sort?.field === field;
              const Icon = !active ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown;
              return (
                <th key={field} aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  {sortable ? (
                    <button className={`sort-button ${active ? 'active' : ''}`} onClick={() => changeSort(field)} type="button">
                      <span>{field}</span>
                      <Icon size={13} />
                    </button>
                  ) : field}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => <tr key={row.id ?? JSON.stringify(row)} onClick={() => onSelect(row)}>{fields.map((field) => <td key={field}>{formatCell(fieldValue(row, field))}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

function compareValues(left: unknown, right: unknown, direction: SortDirection) {
  const multiplier = direction === 'asc' ? 1 : -1;
  const leftValue = sortableValue(left);
  const rightValue = sortableValue(right);
  if (typeof leftValue === 'number' && typeof rightValue === 'number') return (leftValue - rightValue) * multiplier;
  return String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: 'base' }) * multiplier;
}

function sortableValue(value: unknown) {
  if (Array.isArray(value)) return value.join(', ');
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const timestamp = Date.parse(trimmed);
    if (trimmed && !Number.isNaN(timestamp) && /[-/:T]/.test(trimmed)) return timestamp;
    const numeric = Number(trimmed.replace(/[$,%]/g, ''));
    if (trimmed && Number.isFinite(numeric)) return numeric;
    return trimmed;
  }
  if (value && typeof value === 'object') return JSON.stringify(value);
  return value ?? '';
}

function fieldValue(row: AnyRow, field: string) {
  if (field in row) return row[field];
  if (field === 'usdBalance') return row.walletSummary?.usdBalance;
  if (field === 'pendingWithdrawals') return row.walletSummary?.pendingWithdrawals;
  if (field === 'lifetimeDeposits') return row.walletSummary?.lifetimeDeposits;
  if (field === 'lifetimeWithdrawals') return row.walletSummary?.lifetimeWithdrawals;
  return field.split('.').reduce((current, key) => current?.[key], row);
}

function formatCell(value: unknown) {
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '');
}

createRoot(document.getElementById('root')!).render(<App />);
