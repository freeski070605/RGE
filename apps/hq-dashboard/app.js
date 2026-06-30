const state = {
  tab: 'Command Center',
  commandCenter: null,
  platform: null,
  signals: [],
  growthPlays: []
};

const money = (cents) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(cents / 100);

const getJson = async (path) => {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Request failed: ${path}`);
  return response.json();
};

const load = async () => {
  const [platform, commandCenter, signals, growthPlays] = await Promise.all([
    getJson('/api/platform'),
    getJson('/api/command-center'),
    getJson('/api/game-intelligence/signals'),
    getJson('/api/rge/growth-plays')
  ]);

  state.platform = platform;
  state.commandCenter = commandCenter;
  state.signals = signals;
  state.growthPlays = growthPlays;
  render();
};

const navButton = (label) =>
  `<button class="${state.tab === label ? 'active' : ''}" data-tab="${label}">${label}</button>`;

const metric = (label, value, helper) => `
  <article class="metric">
    <span>${label}</span>
    <strong>${value}</strong>
    <p class="muted">${helper}</p>
  </article>`;

const growthPlayCard = (play) => `
  <article class="play">
    <div>
      <span class="eyebrow">RGE Growth Engine</span>
      <h2>${play.title}</h2>
    </div>
    <div class="badge-row">
      <span class="badge growth">${play.playType}</span>
      <span class="badge">${play.urgency}</span>
      <span class="badge ai">${play.recommendedFormat}</span>
      <span class="badge score">Score ${Math.round(play.finalScore)}</span>
    </div>
    <p>${play.whyItMatters}</p>
    <p><strong>Recommended action:</strong> ${play.recommendedAction}</p>
    <div class="panel">
      <span class="eyebrow">Why this?</span>
      <p>${play.whyThis.sourceSignals.join(' ')}</p>
      <p class="muted">${play.whyThis.scoreBoosts.join(' | ')}</p>
      <p class="muted">${play.whyThis.campaignFit}</p>
    </div>
  </article>`;

const renderCommandCenter = () => {
  const cc = state.commandCenter;
  return `
    <section class="grid metrics">
      ${metric('Active users today', cc.activeUsersToday, 'Players active across cribs and tables.')}
      ${metric('Games played today', cc.gamesPlayedToday, 'Completed and active sessions.')}
      ${metric('Tables active now', cc.tablesActiveNow, 'Live tables needing liquidity.')}
      ${metric('Open support issues', cc.openSupportIssues, 'Operator attention queue.')}
    </section>
    <section class="grid columns">
      <div class="grid">
        ${growthPlayCard(cc.bestGrowthPlay)}
        <article class="panel">
          <span class="eyebrow">Game Intelligence</span>
          <h2>Signals feeding HQ right now</h2>
          <div class="list">
            ${state.signals
              .map(
                (signal) => `
                  <div class="signal">
                    <strong>${signal.summary}</strong>
                    <p class="muted">${signal.signalType} | confidence ${signal.confidence}%</p>
                  </div>`
              )
              .join('')}
          </div>
        </article>
      </div>
      <aside class="grid">
        <article class="panel">
          <span class="eyebrow">Hottest crib</span>
          <h2>${cc.hottestCrib.cribName}</h2>
          <p>${cc.hottestCrib.description}</p>
          <p class="muted">Growth priority ${cc.hottestCrib.growthPriority}</p>
        </article>
        <article class="panel">
          <span class="eyebrow">Biggest win</span>
          <h2>${money(cc.biggestWin.amountCents)}</h2>
          <p>${cc.biggestWin.displayName} at ${cc.biggestWin.tableName}</p>
        </article>
        <article class="panel">
          <span class="eyebrow">System Health</span>
          ${cc.systemHealth
            .map((item) => `<div class="row"><span>${item.component}</span><strong>${item.status}</strong></div>`)
            .join('')}
        </article>
      </aside>
    </section>`;
};

const renderGrowthPlays = () => `
  <section class="grid">
    ${state.growthPlays.map(growthPlayCard).join('')}
  </section>`;

const renderModuleList = () => `
  <section class="grid columns">
    <article class="panel">
      <span class="eyebrow">HQ Modules</span>
      <h2>ReemTeam HQ platform map</h2>
      <div class="list">
        ${state.platform.modules.map((module) => `<div class="row"><span>${module}</span><strong>HQ</strong></div>`).join('')}
      </div>
    </article>
    <article class="panel">
      <span class="eyebrow">Pipeline</span>
      <h2>How growth moves through HQ</h2>
      <div class="list">
        ${state.platform.pipeline.map((step, index) => `<div class="row"><span>${index + 1}. ${step}</span></div>`).join('')}
      </div>
    </article>
  </section>`;

const render = () => {
  const app = document.querySelector('#app');
  if (!state.commandCenter || !state.platform) {
    app.innerHTML = '<main class="main"><p>Loading ReemTeam HQ...</p></main>';
    return;
  }

  const body =
    state.tab === 'Command Center'
      ? renderCommandCenter()
      : state.tab === 'RGE Growth Engine'
        ? renderGrowthPlays()
        : renderModuleList();

  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <strong>ReemTeam HQ</strong>
          <span>Private command center</span>
        </div>
        <nav class="nav">
          ${['Command Center', 'CRM', 'Users', 'Tables', 'Cribs', 'Events', 'Game Intelligence', 'RGE Growth Engine', 'Content Studio', 'Referrals', 'Wallet/Ops', 'Support', 'Analytics', 'System Health']
            .map(navButton)
            .join('')}
        </nav>
      </aside>
      <main class="main">
        <header class="topbar">
          <div>
            <span class="eyebrow">${state.tab}</span>
            <h1>${state.tab === 'Command Center' ? state.commandCenter.question : state.tab}</h1>
            <p class="muted">Fresh HQ scaffold. RGE is a new native Growth Engine module inside this platform.</p>
          </div>
          <button id="refresh">Refresh</button>
        </header>
        ${body}
      </main>
    </div>`;

  document.querySelectorAll('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      state.tab = button.getAttribute('data-tab');
      render();
    });
  });
  document.querySelector('#refresh').addEventListener('click', load);
};

render();
load().catch((error) => {
  document.querySelector('#app').innerHTML = `<main class="main"><h1>ReemTeam HQ could not load</h1><p>${error.message}</p></main>`;
});
