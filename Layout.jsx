<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Azure Custodian — Cloud Cost Intelligence</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0a0c0f;--bg1:#0f1217;--bg2:#151a22;--bg3:#1c2330;
  --bd:#232d3f;--bd2:#2d3a50;--bd3:#3a4a66;
  --tx:#e2e8f4;--tx2:#8896b0;--tx3:#4a5878;
  --ac:#00d4ff;--ac2:#0099cc;
  --grn:#00e5a0;--amb:#ffb547;--red:#ff4e6a;--pur:#9b7cff;
  --fs:'Syne',sans-serif;--fb:'DM Sans',sans-serif;--fm:'DM Mono',monospace;
}
html,body{height:100%;background:var(--bg);color:var(--tx);font-family:var(--fb);font-size:13px;line-height:1.6;-webkit-font-smoothing:antialiased}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:var(--bg1)}
::-webkit-scrollbar-thumb{background:var(--bd2);border-radius:3px}
.shell{display:flex;height:100vh;overflow:hidden}

/* ── Sidebar ── */
.sidebar{width:210px;flex-shrink:0;background:var(--bg1);border-right:1px solid var(--bd);display:flex;flex-direction:column}
.logo{padding:18px 16px 14px;border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:10px}
.logo-icon{width:32px;height:32px;background:var(--ac);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.logo-name{font-family:var(--fs);font-weight:700;font-size:15px;color:var(--tx);line-height:1.2}
.logo-sub{font-size:10px;color:var(--tx3);font-family:var(--fm);margin-top:1px}
nav{flex:1;padding:12px 8px;display:flex;flex-direction:column;gap:2px}
.ni{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:6px;cursor:pointer;font-size:12.5px;color:var(--tx2);transition:all .12s;border:none;background:none;width:100%;text-align:left;font-family:var(--fb)}
.ni:hover{background:var(--bg2);color:var(--tx)}
.ni.on{background:rgba(0,212,255,.1);color:var(--ac)}
.ni svg{flex-shrink:0;opacity:.7}
.ni.on svg{opacity:1}
.sidebar-foot{padding:10px 16px;border-top:1px solid var(--bd);display:flex;align-items:center;gap:6px;font-size:10px;color:var(--tx3);font-family:var(--fm)}
.pulse-dot{width:6px;height:6px;border-radius:50%;background:var(--grn);animation:pdot 1.4s ease-in-out infinite;flex-shrink:0}
@keyframes pdot{0%,100%{opacity:1}50%{opacity:.2}}

/* ── Main ── */
.main{flex:1;overflow-y:auto;overflow-x:hidden;background:var(--bg)}
.page{padding:26px 30px;display:none;animation:fadein .25s ease}
.page.on{display:block}
@keyframes fadein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
h1{font-family:var(--fs);font-size:24px;font-weight:700;color:var(--tx);margin-bottom:4px}
.ph{font-size:12px;color:var(--tx2);margin-bottom:22px}

/* ── Cards ── */
.card{background:var(--bg1);border:1px solid var(--bd);border-radius:8px;padding:18px 20px}
.card-sm{background:var(--bg2);border:1px solid var(--bd);border-radius:6px;padding:14px 16px}
.card-hd{font-family:var(--fs);font-weight:600;font-size:13px;color:var(--tx);margin-bottom:14px;display:flex;justify-content:space-between;align-items:center}
.card-hd a{font-size:11px;color:var(--ac);text-decoration:none;font-family:var(--fb);font-weight:400}
.card-hd span{font-size:10px;color:var(--tx3);font-family:var(--fm);font-weight:400}

/* ── KPI grid ── */
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px}
.kpi{background:var(--bg1);border:1px solid var(--bd);border-radius:8px;padding:16px 18px;position:relative;overflow:hidden}
.kpi-lbl{font-size:10px;color:var(--tx3);font-family:var(--fm);text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px}
.kpi-val{font-family:var(--fs);font-size:28px;font-weight:700;line-height:1;margin-bottom:4px}
.kpi-note{font-size:11px;color:var(--tx3)}
.kpi-bar{position:absolute;bottom:0;left:0;right:0;height:2px;opacity:.35}

/* ── Grid layouts ── */
.g2{display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:14px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px}
.g2eq{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}

/* ── Tables ── */
.tbl-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;min-width:500px}
th{text-align:left;padding:8px 12px;font-size:10px;color:var(--tx3);font-family:var(--fm);text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid var(--bd);white-space:nowrap}
td{padding:10px 12px;border-bottom:1px solid var(--bd);font-size:12px;color:var(--tx2);vertical-align:middle}
tr:last-child td{border-bottom:none}
tbody tr:hover td{background:rgba(255,255,255,.02)}

/* ── Badges ── */
.badge{display:inline-flex;align-items:center;padding:2px 7px;border-radius:4px;font-size:10px;font-family:var(--fm);font-weight:500;letter-spacing:.04em;text-transform:uppercase}
.bc{background:rgba(255,78,106,.15);color:var(--red)}
.bh{background:rgba(255,181,71,.15);color:var(--amb)}
.bm{background:rgba(155,124,255,.15);color:var(--pur)}
.bl{background:rgba(0,212,255,.15);color:var(--ac)}
.bg{background:rgba(0,229,160,.15);color:var(--grn)}

/* ── Buttons ── */
.btn{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:6px;font-size:12px;font-weight:500;font-family:var(--fb);cursor:pointer;transition:all .15s;border:none;outline:none;white-space:nowrap}
.btn-p{background:var(--ac);color:#000}
.btn-p:hover{background:#00bde0}
.btn-p:active{transform:scale(.98)}
.btn-g{background:transparent;color:var(--tx2);border:1px solid var(--bd)}
.btn-g:hover{border-color:var(--bd2);color:var(--tx);background:var(--bg2)}
.btn-d{background:transparent;color:var(--red);border:1px solid rgba(255,78,106,.3)}
.btn-d:hover{background:rgba(255,78,106,.08)}
.btn-s{background:transparent;color:var(--grn);border:1px solid rgba(0,229,160,.3)}
.btn-s:hover{background:rgba(0,229,160,.08)}
.btn-sm{padding:4px 9px;font-size:11px}

/* ── Status dots ── */
.dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex-shrink:0}
.dot-run{background:var(--ac);animation:pdot 1.4s ease-in-out infinite}
.dot-ok{background:var(--grn)}
.dot-err{background:var(--red)}
.dot-pend{background:var(--amb)}
.dot-off{background:var(--tx3)}
.status-row{display:flex;align-items:center;gap:6px;font-size:11px;font-family:var(--fm)}

/* ── Ladder bar ── */
.ladder{display:flex;align-items:center;gap:3px}
.lrung{width:18px;height:4px;border-radius:2px}

/* ── Pills filter ── */
.pills{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;align-items:center}
.pill{padding:4px 11px;border-radius:5px;font-size:11px;font-family:var(--fm);cursor:pointer;border:1px solid var(--bd);background:none;color:var(--tx2);transition:all .12s}
.pill:hover,.pill.on{border-color:var(--ac);color:var(--ac);background:rgba(0,212,255,.08)}
.pill-div{width:1px;height:18px;background:var(--bd);margin:0 2px}

/* ── Toggle ── */
.tog{width:30px;height:17px;border-radius:9px;background:var(--bd2);border:none;cursor:pointer;position:relative;transition:background .2s;flex-shrink:0}
.tog.on{background:var(--grn)}
.tog::after{content:'';position:absolute;width:13px;height:13px;border-radius:50%;background:#fff;top:2px;left:2px;transition:left .2s}
.tog.on::after{left:15px}

/* ── Search ── */
.search{position:relative;margin-bottom:14px}
.search input{width:100%;background:var(--bg2);border:1px solid var(--bd);border-radius:6px;color:var(--tx);font-size:12px;padding:7px 10px 7px 30px;outline:none;transition:border-color .15s;font-family:var(--fb)}
.search input:focus{border-color:var(--ac)}
.search svg{position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--tx3);pointer-events:none}

/* ── Form elements ── */
.fld{margin-bottom:14px}
.fld label{font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;font-weight:500;display:block;margin-bottom:5px;font-family:var(--fm)}
.fld input,.fld select,.fld textarea{width:100%;background:var(--bg2);border:1px solid var(--bd);border-radius:6px;color:var(--tx);font-size:12px;padding:7px 10px;outline:none;transition:border-color .15s;font-family:var(--fb)}
.fld input:focus,.fld select:focus,.fld textarea:focus{border-color:var(--ac)}
.fld textarea{resize:vertical;font-family:var(--fm);font-size:11px;line-height:1.6}
.g2-form{display:grid;grid-template-columns:1fr 1fr;gap:12px}

/* ── Action menu ── */
.act-wrap{position:relative;display:inline-block}
.act-menu{position:absolute;right:0;top:calc(100% + 4px);background:var(--bg2);border:1px solid var(--bd2);border-radius:8px;min-width:152px;overflow:hidden;z-index:100;box-shadow:0 8px 24px rgba(0,0,0,.5)}
.act-menu button{display:block;width:100%;text-align:left;padding:8px 14px;background:transparent;border:none;font-size:12px;cursor:pointer;font-family:var(--fb);transition:background .1s}
.act-menu button:hover{background:var(--bg3)}

/* ── Progress bar ── */
.pbar{height:5px;background:var(--bg3);border-radius:3px;overflow:hidden}
.pbar-fill{height:100%;border-radius:3px;transition:width .4s}

/* ── Inline policy editor panel ── */
.policy-editor{display:none;background:var(--bg1);border:1px solid var(--bd2);border-radius:10px;margin-bottom:16px;overflow:hidden}
.policy-editor.on{display:block}
.ped-hd{padding:14px 18px;border-bottom:1px solid var(--bd);display:flex;justify-content:space-between;align-items:center}
.ped-hd span{font-family:var(--fs);font-weight:600;font-size:14px}
.ped-body{padding:18px}
.ped-ft{padding:12px 18px;border-top:1px solid var(--bd);display:flex;gap:8px}

/* ── Toast ── */
#toast{position:fixed;bottom:24px;right:24px;background:var(--bg2);border:1px solid var(--bd2);border-radius:8px;padding:10px 16px;font-size:12px;color:var(--tx);z-index:999;opacity:0;transform:translateY(8px);transition:all .25s;pointer-events:none;max-width:320px}
#toast.show{opacity:1;transform:translateY(0)}

/* ── Misc ── */
.mono{font-family:var(--fm)}
.dim{color:var(--tx3)}
.acct{color:var(--ac)}
.fw{font-weight:600;color:var(--tx)}
.red{color:var(--red)}
.grn{color:var(--grn)}
.amb{color:var(--amb)}
.pur{color:var(--pur)}
.divider{width:100%;height:1px;background:var(--bd);margin:18px 0}
.header-row{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px}
.flex-gap{display:flex;gap:8px;align-items:center}
.tag-chip{font-size:10px;font-family:var(--fm);background:var(--bg3);padding:2px 8px;border-radius:4px;color:var(--tx2);border:1px solid var(--bd)}
.cat-pill{font-size:10px;font-family:var(--fm);padding:2px 7px;border-radius:4px}
</style>
</head>
<body>
<div class="shell">

<!-- ── SIDEBAR ────────────────────────────────────────── -->
<aside class="sidebar">
  <div class="logo">
    <div class="logo-icon">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" fill="#000" stroke="#000" stroke-width=".5"/>
        <path d="M9 5L13 7.5V12.5L9 15L5 12.5V7.5L9 5Z" fill="#00d4ff"/>
      </svg>
    </div>
    <div>
      <div class="logo-name">Custodian</div>
      <div class="logo-sub">Azure Cost Intel</div>
    </div>
  </div>
  <nav>
    <button class="ni on" onclick="goPage('dash',this)">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor"/><rect x="8" y="1" width="5" height="5" rx="1" fill="currentColor" opacity=".5"/><rect x="1" y="8" width="5" height="5" rx="1" fill="currentColor" opacity=".5"/><rect x="8" y="8" width="5" height="5" rx="1" fill="currentColor" opacity=".5"/></svg>
      Dashboard
    </button>
    <button class="ni" onclick="goPage('analytics',this)">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="7" width="3" height="6" fill="currentColor" rx=".5"/><rect x="5.5" y="4" width="3" height="9" fill="currentColor" rx=".5"/><rect x="10" y="1" width="3" height="12" fill="currentColor" rx=".5"/></svg>
      Analytics
    </button>
    <button class="ni" onclick="goPage('resources',this)">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="12" height="4" rx="1" stroke="currentColor" stroke-width="1.2"/><rect x="1" y="8" width="12" height="4" rx="1" stroke="currentColor" stroke-width="1.2"/><circle cx="11.5" cy="4" r="1" fill="currentColor"/><circle cx="11.5" cy="10" r="1" fill="currentColor"/></svg>
      Waste resources
    </button>
    <button class="ni" onclick="goPage('policies',this)">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1L12 3.5V7C12 10 9.5 12.5 7 13C4.5 12.5 2 10 2 7V3.5L7 1Z" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M5 7L6.5 8.5L9.5 5.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Policies
    </button>
    <button class="ni" onclick="goPage('runs',this)">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.2"/><polygon points="5.5,4.5 10.5,7 5.5,9.5" fill="currentColor"/></svg>
      Policy runs
    </button>
    <button class="ni" onclick="goPage('actions',this)">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v4M7 9v4M1 7h4M9 7h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="7" cy="7" r="2" fill="currentColor"/></svg>
      Remediation
    </button>
    <button class="ni" onclick="goPage('settings',this)">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2" stroke="currentColor" stroke-width="1.2"/><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.9 2.9l1.1 1.1M10 10l1.1 1.1M2.9 11.1l1.1-1.1M10 4l1.1-1.1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
      Settings
    </button>
  </nav>
  <div class="sidebar-foot">
    <div class="pulse-dot"></div>
    KEDA autoscaling active
  </div>
</aside>

<!-- ── MAIN ────────────────────────────────────────────── -->
<main class="main">

<!-- DASHBOARD -->
<div id="pg-dash" class="page on">
  <div class="header-row">
    <div>
      <h1>Cost Intelligence</h1>
      <div class="ph">Azure waste detection · all subscriptions · <span id="ts" class="mono" style="font-size:11px"></span></div>
    </div>
    <button class="btn btn-p" onclick="triggerAll()">
      <svg width="11" height="11" viewBox="0 0 12 12"><polygon points="2,1 11,6 2,11" fill="#000"/></svg>
      Run all policies
    </button>
  </div>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-lbl">Identified waste</div><div class="kpi-val red">£47,280</div><div class="kpi-note">per month · all subs</div><div class="kpi-bar" style="background:var(--red)"></div></div>
    <div class="kpi"><div class="kpi-lbl">Realised savings</div><div class="kpi-val grn">£18,940</div><div class="kpi-note">execution efficiency 40%</div><div class="kpi-bar" style="background:var(--grn)"></div></div>
    <div class="kpi"><div class="kpi-lbl">Waste resources</div><div class="kpi-val amb">312</div><div class="kpi-note">pending remediation</div><div class="kpi-bar" style="background:var(--amb)"></div></div>
    <div class="kpi"><div class="kpi-lbl">Runs (24h)</div><div class="kpi-val acct">84</div><div class="kpi-note">1,240 total actions taken</div><div class="kpi-bar" style="background:var(--ac)"></div></div>
  </div>
  <div class="g2">
    <div class="card"><div class="card-hd">Waste identified — 14 days <span>GBP / month</span></div><canvas id="c-trend" height="150"></canvas></div>
    <div class="card"><div class="card-hd">By category</div><canvas id="c-cat" height="150"></canvas></div>
  </div>
  <div class="card">
    <div class="card-hd">Recent policy runs <a href="#" onclick="goPage('runs',document.querySelector('.ni:nth-child(5)'));return false">View all →</a></div>
    <div class="tbl-wrap"><table>
      <tr><th>Status</th><th>Run ID</th><th>Subscription</th><th>Resources</th><th>Waste/mo</th><th>Started</th></tr>
      <tr><td><div class="status-row"><div class="dot dot-run"></div>running</div></td><td class="mono dim" style="font-size:10px">3f8a1c92-ab2d…</td><td>prod-westeurope</td><td>—</td><td>—</td><td class="mono dim" style="font-size:10px">14 Mar 11:42</td></tr>
      <tr><td><div class="status-row"><div class="dot dot-ok"></div>completed</div></td><td class="mono dim" style="font-size:10px">a71f003e-9d44…</td><td>dev-northeurope</td><td class="fw">23</td><td class="mono red fw">£2,140</td><td class="mono dim" style="font-size:10px">14 Mar 10:00</td></tr>
      <tr><td><div class="status-row"><div class="dot dot-ok"></div>completed</div></td><td class="mono dim" style="font-size:10px">c329b814-fe01…</td><td>staging-uksouth</td><td class="fw">8</td><td class="mono red fw">£560</td><td class="mono dim" style="font-size:10px">14 Mar 10:00</td></tr>
      <tr><td><div class="status-row"><div class="dot dot-err"></div>failed</div></td><td class="mono dim" style="font-size:10px">09ff4471-ab11…</td><td>prod-eastus</td><td>—</td><td>—</td><td class="mono dim" style="font-size:10px">14 Mar 02:00</td></tr>
      <tr><td><div class="status-row"><div class="dot dot-ok"></div>completed</div></td><td class="mono dim" style="font-size:10px">7e2c9a05-30c8…</td><td>prod-westeurope</td><td class="fw">41</td><td class="mono red fw">£4,880</td><td class="mono dim" style="font-size:10px">13 Mar 02:00</td></tr>
    </table></div>
  </div>
</div>

<!-- ANALYTICS -->
<div id="pg-analytics" class="page">
  <h1>Analytics</h1>
  <div class="ph">Cost waste breakdown and remediation performance</div>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-lbl">Total waste</div><div class="kpi-val red">£47.3k</div><div class="kpi-note">per month</div><div class="kpi-bar" style="background:var(--red)"></div></div>
    <div class="kpi"><div class="kpi-lbl">Realised savings</div><div class="kpi-val grn">£18.9k</div><div class="kpi-note">per month</div><div class="kpi-bar" style="background:var(--grn)"></div></div>
    <div class="kpi"><div class="kpi-lbl">Efficiency</div><div class="kpi-val amb">40%</div><div class="kpi-note">savings vs identified</div><div class="kpi-bar" style="background:var(--amb)"></div></div>
    <div class="kpi"><div class="kpi-lbl">Resources tracked</div><div class="kpi-val acct">312</div><div class="kpi-note">pending or actioned</div><div class="kpi-bar" style="background:var(--ac)"></div></div>
  </div>
  <div class="g2">
    <div class="card"><div class="card-hd">30-day waste trend <span>GBP/month</span></div><canvas id="c-trend30" height="160"></canvas></div>
    <div class="card"><div class="card-hd">Remediation ladder</div><canvas id="c-ladder" height="160"></canvas></div>
  </div>
  <div class="g3">
    <div class="card"><div class="card-hd">By category</div><canvas id="c-cat2" height="160"></canvas></div>
    <div class="card"><div class="card-hd">By severity</div><canvas id="c-sev" height="160"></canvas></div>
    <div class="card"><div class="card-hd">Scan runs / day</div><canvas id="c-runs" height="160"></canvas></div>
  </div>
  <div class="card">
    <div class="card-hd">Waste by subscription</div>
    <div class="tbl-wrap"><table>
      <tr><th>Subscription</th><th>Resources</th><th>Monthly waste</th><th style="width:220px">Share</th></tr>
      <tr><td class="mono dim" style="font-size:11px">prod-westeurope-9a2f…</td><td class="fw">148</td><td class="mono red fw">£22,400</td><td><div style="display:flex;align-items:center;gap:10px"><div class="pbar" style="flex:1"><div class="pbar-fill" style="width:47%;background:var(--red)"></div></div><span class="mono dim" style="font-size:11px;min-width:28px">47%</span></div></td></tr>
      <tr><td class="mono dim" style="font-size:11px">staging-uksouth-4bc1…</td><td class="fw">89</td><td class="mono red fw">£13,100</td><td><div style="display:flex;align-items:center;gap:10px"><div class="pbar" style="flex:1"><div class="pbar-fill" style="width:28%;background:var(--amb)"></div></div><span class="mono dim" style="font-size:11px;min-width:28px">28%</span></div></td></tr>
      <tr><td class="mono dim" style="font-size:11px">dev-northeurope-c7f9…</td><td class="fw">75</td><td class="mono red fw">£11,780</td><td><div style="display:flex;align-items:center;gap:10px"><div class="pbar" style="flex:1"><div class="pbar-fill" style="width:25%;background:var(--pur)"></div></div><span class="mono dim" style="font-size:11px;min-width:28px">25%</span></div></td></tr>
    </table></div>
  </div>
</div>

<!-- WASTE RESOURCES -->
<div id="pg-resources" class="page">
  <div class="header-row">
    <div>
      <h1>Waste Resources</h1>
      <div class="ph">312 resources · <span class="mono red">£47,280/mo</span> identified</div>
    </div>
  </div>
  <div class="pills" id="res-pills">
    <button class="pill on" data-filter="all" onclick="filterCat(this)">All</button>
    <button class="pill" data-filter="idle" onclick="filterCat(this)">idle</button>
    <button class="pill" data-filter="orphaned" onclick="filterCat(this)">orphaned</button>
    <button class="pill" data-filter="right-size" onclick="filterCat(this)">right-size</button>
    <button class="pill" data-filter="tagging" onclick="filterCat(this)">tagging</button>
    <button class="pill" data-filter="storage" onclick="filterCat(this)">storage</button>
    <div class="pill-div"></div>
    <button class="pill" data-filter="notify" onclick="filterLadder(this)">notify</button>
    <button class="pill" data-filter="tagged" onclick="filterLadder(this)">tagged</button>
    <button class="pill" data-filter="deallocated" onclick="filterLadder(this)">deallocated</button>
  </div>
  <div class="search">
    <svg width="13" height="13" viewBox="0 0 13 13"><circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" stroke-width="1.3"/><line x1="8.5" y1="8.5" x2="12" y2="12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
    <input type="text" placeholder="Search by name, group or type…" oninput="searchRes(this.value)"/>
  </div>
  <div class="card" style="padding:0;overflow:hidden">
    <div class="tbl-wrap"><table>
      <thead><tr><th>Resource</th><th>Group</th><th>Location</th><th>Severity</th><th>Cost/mo</th><th>Ladder</th><th>Actions</th></tr></thead>
      <tbody id="res-tbody">
        <tr data-cat="idle" data-ladder="tagged" data-name="vm-prod-worker-03"><td><div class="fw">vm-prod-worker-03</div><div class="mono dim" style="font-size:10px">azure.vm · Standard_D8s_v3</div></td><td>rg-prod-compute</td><td>westeurope</td><td><span class="badge bc">critical</span></td><td class="mono red fw">£384</td><td><div class="ladder"><div class="lrung" style="background:var(--tx3)"></div><div class="lrung" style="background:var(--amb)"></div><div class="lrung" style="background:var(--bd)"></div><div class="lrung" style="background:var(--bd)"></div><span class="mono amb" style="font-size:10px;margin-left:5px">tagged</span></div></td><td><div class="act-wrap"><button class="btn btn-sm btn-d" onclick="toggleMenu(this)">Act ▾</button><div class="act-menu" style="display:none"><button onclick="doAction('Deallocate','vm-prod-worker-03',this)" style="color:var(--pur)">Deallocate</button><button onclick="doAction('Snapshot','vm-prod-worker-03',this)" style="color:var(--ac)">Snapshot first</button><button onclick="doAction('Resize to B2s','vm-prod-worker-03',this)" style="color:var(--grn)">Resize (B2s)</button><button onclick="doAction('Delete','vm-prod-worker-03',this)" style="color:var(--red)">Delete</button><button onclick="markExempt('vm-prod-worker-03',this)" style="color:var(--grn)">Mark exempt</button></div></div></td></tr>
        <tr data-cat="orphaned" data-ladder="notify" data-name="disk-old-backup-07"><td><div class="fw">disk-old-backup-07</div><div class="mono dim" style="font-size:10px">azure.disk · 512 GB</div></td><td>rg-legacy</td><td>uksouth</td><td><span class="badge bh">high</span></td><td class="mono red fw">£82</td><td><div class="ladder"><div class="lrung" style="background:var(--tx3)"></div><div class="lrung" style="background:var(--bd)"></div><div class="lrung" style="background:var(--bd)"></div><div class="lrung" style="background:var(--bd)"></div><span class="mono dim" style="font-size:10px;margin-left:5px">notify</span></div></td><td><div class="act-wrap"><button class="btn btn-sm btn-d" onclick="toggleMenu(this)">Act ▾</button><div class="act-menu" style="display:none"><button onclick="doAction('Snapshot','disk-old-backup-07',this)" style="color:var(--ac)">Snapshot first</button><button onclick="doAction('Delete','disk-old-backup-07',this)" style="color:var(--red)">Delete</button><button onclick="markExempt('disk-old-backup-07',this)" style="color:var(--grn)">Mark exempt</button></div></div></td></tr>
        <tr data-cat="idle" data-ladder="deallocated" data-name="sql-analytics-prod"><td><div class="fw">sql-analytics-prod</div><div class="mono dim" style="font-size:10px">azure.sqldatabase · S4</div></td><td>rg-data</td><td>westeurope</td><td><span class="badge bc">critical</span></td><td class="mono red fw">£320</td><td><div class="ladder"><div class="lrung" style="background:var(--tx3)"></div><div class="lrung" style="background:var(--amb)"></div><div class="lrung" style="background:var(--pur)"></div><div class="lrung" style="background:var(--bd)"></div><span class="mono pur" style="font-size:10px;margin-left:5px">deallocated</span></div></td><td><div class="act-wrap"><button class="btn btn-sm btn-d" onclick="toggleMenu(this)">Act ▾</button><div class="act-menu" style="display:none"><button onclick="doAction('Delete','sql-analytics-prod',this)" style="color:var(--red)">Delete</button><button onclick="markExempt('sql-analytics-prod',this)" style="color:var(--grn)">Mark exempt</button></div></div></td></tr>
        <tr data-cat="right-size" data-ladder="notify" data-name="vm-api-gateway-01"><td><div class="fw">vm-api-gateway-01</div><div class="mono dim" style="font-size:10px">azure.vm · Standard_D4s_v3</div></td><td>rg-prod-network</td><td>westeurope</td><td><span class="badge bm">medium</span></td><td class="mono red fw">£192</td><td><div class="ladder"><div class="lrung" style="background:var(--tx3)"></div><div class="lrung" style="background:var(--bd)"></div><div class="lrung" style="background:var(--bd)"></div><div class="lrung" style="background:var(--bd)"></div><span class="mono dim" style="font-size:10px;margin-left:5px">notify</span></div></td><td><div class="act-wrap"><button class="btn btn-sm btn-s" onclick="toggleMenu(this)">Act ▾</button><div class="act-menu" style="display:none"><button onclick="doAction('Resize to B2s','vm-api-gateway-01',this)" style="color:var(--grn)">Resize (B2s)</button><button onclick="doAction('Deallocate','vm-api-gateway-01',this)" style="color:var(--pur)">Deallocate</button><button onclick="markExempt('vm-api-gateway-01',this)" style="color:var(--grn)">Mark exempt</button></div></div></td></tr>
        <tr data-cat="orphaned" data-ladder="notify" data-name="pip-unused-frontend"><td><div class="fw">pip-unused-frontend</div><div class="mono dim" style="font-size:10px">azure.publicip</div></td><td>rg-prod-network</td><td>westeurope</td><td><span class="badge bl">low</span></td><td class="mono red fw">£4</td><td><div class="ladder"><div class="lrung" style="background:var(--tx3)"></div><div class="lrung" style="background:var(--bd)"></div><div class="lrung" style="background:var(--bd)"></div><div class="lrung" style="background:var(--bd)"></div><span class="mono dim" style="font-size:10px;margin-left:5px">notify</span></div></td><td><div class="act-wrap"><button class="btn btn-sm btn-d" onclick="toggleMenu(this)">Act ▾</button><div class="act-menu" style="display:none"><button onclick="doAction('Delete','pip-unused-frontend',this)" style="color:var(--red)">Delete</button><button onclick="markExempt('pip-unused-frontend',this)" style="color:var(--grn)">Mark exempt</button></div></div></td></tr>
        <tr data-cat="storage" data-ladder="tagged" data-name="storage-logs-archive"><td><div class="fw">storage-logs-archive</div><div class="mono dim" style="font-size:10px">azure.storage · Hot tier</div></td><td>rg-monitoring</td><td>northeurope</td><td><span class="badge bm">medium</span></td><td class="mono red fw">£48</td><td><div class="ladder"><div class="lrung" style="background:var(--tx3)"></div><div class="lrung" style="background:var(--amb)"></div><div class="lrung" style="background:var(--bd)"></div><div class="lrung" style="background:var(--bd)"></div><span class="mono amb" style="font-size:10px;margin-left:5px">tagged</span></div></td><td><div class="act-wrap"><button class="btn btn-sm btn-s" onclick="toggleMenu(this)">Act ▾</button><div class="act-menu" style="display:none"><button onclick="doAction('Tier-down to Cool','storage-logs-archive',this)" style="color:var(--grn)">Tier to Cool</button><button onclick="doAction('Delete','storage-logs-archive',this)" style="color:var(--red)">Delete</button></div></div></td></tr>
        <tr data-cat="tagging" data-ladder="notify" data-name="vm-ml-training-09"><td><div class="fw">vm-ml-training-09</div><div class="mono dim" style="font-size:10px">azure.vm · Standard_D8s_v5</div></td><td>rg-ml</td><td>uksouth</td><td><span class="badge bh">high</span></td><td class="mono red fw">£348</td><td><div class="ladder"><div class="lrung" style="background:var(--tx3)"></div><div class="lrung" style="background:var(--bd)"></div><div class="lrung" style="background:var(--bd)"></div><div class="lrung" style="background:var(--bd)"></div><span class="mono dim" style="font-size:10px;margin-left:5px">notify</span></div></td><td><div class="act-wrap"><button class="btn btn-sm btn-d" onclick="toggleMenu(this)">Act ▾</button><div class="act-menu" style="display:none"><button onclick="doAction('Tag for deletion','vm-ml-training-09',this)" style="color:var(--amb)">Tag for deletion</button><button onclick="doAction('Deallocate','vm-ml-training-09',this)" style="color:var(--pur)">Deallocate</button><button onclick="markExempt('vm-ml-training-09',this)" style="color:var(--grn)">Mark exempt</button></div></div></td></tr>
        <tr data-cat="idle" data-ladder="notify" data-name="appplan-empty-staging"><td><div class="fw">appplan-empty-staging</div><div class="mono dim" style="font-size:10px">azure.appserviceplan · P2v3 · 0 apps</div></td><td>rg-staging</td><td>uksouth</td><td><span class="badge bh">high</span></td><td class="mono red fw">£148</td><td><div class="ladder"><div class="lrung" style="background:var(--tx3)"></div><div class="lrung" style="background:var(--bd)"></div><div class="lrung" style="background:var(--bd)"></div><div class="lrung" style="background:var(--bd)"></div><span class="mono dim" style="font-size:10px;margin-left:5px">notify</span></div></td><td><div class="act-wrap"><button class="btn btn-sm btn-d" onclick="toggleMenu(this)">Act ▾</button><div class="act-menu" style="display:none"><button onclick="doAction('Delete','appplan-empty-staging',this)" style="color:var(--red)">Delete</button><button onclick="markExempt('appplan-empty-staging',this)" style="color:var(--grn)">Mark exempt</button></div></div></td></tr>
      </tbody>
    </table></div>
  </div>
</div>

<!-- POLICIES -->
<div id="pg-policies" class="page">
  <div class="header-row">
    <div>
      <h1>Policies</h1>
      <div class="ph" id="pol-count">7 policies · 6 active</div>
    </div>
    <button class="btn btn-p" onclick="openPolicyEditor()">+ New policy</button>
  </div>

  <!-- Inline editor panel -->
  <div class="policy-editor" id="policy-editor">
    <div class="ped-hd">
      <span id="ped-title">New policy</span>
      <button class="btn btn-g btn-sm" onclick="closePolicyEditor()">✕ Close</button>
    </div>
    <div class="ped-body">
      <div class="g2-form" style="margin-bottom:0">
        <div class="fld"><label>Name</label><input type="text" id="pol-name" placeholder="idle-vm-notify"/></div>
        <div class="fld"><label>Description</label><input type="text" id="pol-desc" placeholder="Short description of what this catches"/></div>
        <div class="fld"><label>Resource type</label>
          <select id="pol-rtype">
            <option>azure.vm</option><option>azure.disk</option><option>azure.publicip</option>
            <option>azure.sqldatabase</option><option>azure.storage</option>
            <option>azure.appserviceplan</option><option>azure.resourcegroup</option>
          </select>
        </div>
        <div class="fld"><label>Category</label>
          <select id="pol-cat">
            <option>idle</option><option>orphaned</option><option>right-size</option>
            <option>tagging</option><option>storage</option>
          </select>
        </div>
        <div class="fld"><label>Severity</label>
          <select id="pol-sev">
            <option>low</option><option selected>medium</option><option>high</option><option>critical</option>
          </select>
        </div>
        <div class="fld"><label>Grace period (hours)</label>
          <input type="number" id="pol-grace" value="72" min="1" max="720"/>
        </div>
        <div class="fld"><label>Schedule (cron, optional)</label>
          <input type="text" id="pol-sched" placeholder="0 2 * * *"/>
        </div>
        <div class="fld"><label>Enabled</label>
          <select id="pol-enabled"><option value="1">Yes — active</option><option value="0">No — disabled</option></select>
        </div>
      </div>
      <div class="fld" style="margin-top:4px"><label>Policy YAML</label>
        <textarea id="pol-yaml" style="height:240px">policies:
  - name: my-policy
    resource: azure.vm
    filters:
      - type: metric
        name: Percentage CPU
        aggregation: average
        op: less-than
        threshold: 5
        timeframe: 168
      - "tag:custodian_status": absent
    actions:
      - type: tag
        tags:
          custodian_status: "idle-notify"
          custodian_date: "{now}"
</textarea>
      </div>
      <!-- Validation result panel -->
      <div id="val-panel" style="display:none;margin-top:12px;padding:0 0 4px 0"></div>
    </div>
    <div class="ped-ft">
      <button class="btn btn-p" id="save-btn" onclick="savePolicy()" style="opacity:.4;cursor:not-allowed" disabled>Save policy</button>
      <button class="btn btn-g" id="test-btn" onclick="testPolicy()">
        &#9654; Test policy
      </button>
      <button class="btn btn-g" onclick="closePolicyEditor()">Cancel</button>
    </div>
  </div>
  <div style="display:flex;flex-direction:column;gap:10px" id="pol-list">
    <div class="card" style="display:flex;align-items:center;gap:14px;cursor:pointer;padding:14px 18px" onclick="editPolicy('idle-vm-notify')">
      <div style="width:4px;height:42px;border-radius:2px;background:var(--red);flex-shrink:0"></div>
      <div style="flex:1;min-width:0">
        <div class="flex-gap" style="margin-bottom:4px"><span class="fw" style="font-size:13px">idle-vm-notify</span><span class="badge bc">critical</span><span class="cat-pill" style="background:rgba(255,78,106,.1);color:var(--red)">idle</span></div>
        <div class="dim" style="font-size:11px">azure.vm · VMs with &lt;5% CPU over 7 days · 72h grace period · <span class="mono">0 2 * * *</span></div>
      </div>
      <button class="tog on" onclick="event.stopPropagation();togglePolicy(this)"></button>
    </div>
    <div class="card" style="display:flex;align-items:center;gap:14px;cursor:pointer;padding:14px 18px" onclick="editPolicy('unattached-managed-disk')">
      <div style="width:4px;height:42px;border-radius:2px;background:var(--amb);flex-shrink:0"></div>
      <div style="flex:1;min-width:0">
        <div class="flex-gap" style="margin-bottom:4px"><span class="fw" style="font-size:13px">unattached-managed-disk</span><span class="badge bh">high</span><span class="cat-pill" style="background:rgba(255,181,71,.1);color:var(--amb)">orphaned</span></div>
        <div class="dim" style="font-size:11px">azure.disk · diskState = Unattached · 24h grace period · <span class="mono">0 * * * *</span></div>
      </div>
      <button class="tog on" onclick="event.stopPropagation();togglePolicy(this)"></button>
    </div>
    <div class="card" style="display:flex;align-items:center;gap:14px;cursor:pointer;padding:14px 18px;opacity:.5" onclick="editPolicy('idle-azure-sql')">
      <div style="width:4px;height:42px;border-radius:2px;background:var(--red);flex-shrink:0"></div>
      <div style="flex:1;min-width:0">
        <div class="flex-gap" style="margin-bottom:4px"><span class="fw" style="font-size:13px">idle-azure-sql</span><span class="badge bc">critical</span><span class="cat-pill" style="background:rgba(255,78,106,.1);color:var(--red)">idle</span></div>
        <div class="dim" style="font-size:11px">azure.sqldatabase · DTU &lt;2% over 14 days · 48h grace period</div>
      </div>
      <button class="tog" onclick="event.stopPropagation();togglePolicy(this)"></button>
    </div>
    <div class="card" style="display:flex;align-items:center;gap:14px;cursor:pointer;padding:14px 18px" onclick="editPolicy('missing-required-tags')">
      <div style="width:4px;height:42px;border-radius:2px;background:var(--ac);flex-shrink:0"></div>
      <div style="flex:1;min-width:0">
        <div class="flex-gap" style="margin-bottom:4px"><span class="fw" style="font-size:13px">missing-required-tags</span><span class="badge bm">medium</span><span class="cat-pill" style="background:rgba(0,212,255,.1);color:var(--ac)">tagging</span></div>
        <div class="dim" style="font-size:11px">azure.resourcegroup · Missing Owner / Environment / CostCenter tags · 168h grace</div>
      </div>
      <button class="tog on" onclick="event.stopPropagation();togglePolicy(this)"></button>
    </div>
    <div class="card" style="display:flex;align-items:center;gap:14px;cursor:pointer;padding:14px 18px" onclick="editPolicy('old-blobs-in-hot-tier')">
      <div style="width:4px;height:42px;border-radius:2px;background:var(--grn);flex-shrink:0"></div>
      <div style="flex:1;min-width:0">
        <div class="flex-gap" style="margin-bottom:4px"><span class="fw" style="font-size:13px">old-blobs-in-hot-tier</span><span class="badge bm">medium</span><span class="cat-pill" style="background:rgba(0,229,160,.1);color:var(--grn)">storage</span></div>
        <div class="dim" style="font-size:11px">azure.storage · Hot tier · &lt;100 transactions / 30 days · 72h grace</div>
      </div>
      <button class="tog on" onclick="event.stopPropagation();togglePolicy(this)"></button>
    </div>
    <div class="card" style="display:flex;align-items:center;gap:14px;cursor:pointer;padding:14px 18px" onclick="editPolicy('unattached-public-ip')">
      <div style="width:4px;height:42px;border-radius:2px;background:var(--amb);flex-shrink:0"></div>
      <div style="flex:1;min-width:0">
        <div class="flex-gap" style="margin-bottom:4px"><span class="fw" style="font-size:13px">unattached-public-ip</span><span class="badge bl">low</span><span class="cat-pill" style="background:rgba(255,181,71,.1);color:var(--amb)">orphaned</span></div>
        <div class="dim" style="font-size:11px">azure.publicip · ipConfiguration = null · 1h grace period</div>
      </div>
      <button class="tog on" onclick="event.stopPropagation();togglePolicy(this)"></button>
    </div>
    <div class="card" style="display:flex;align-items:center;gap:14px;cursor:pointer;padding:14px 18px" onclick="editPolicy('empty-app-service-plan')">
      <div style="width:4px;height:42px;border-radius:2px;background:var(--pur);flex-shrink:0"></div>
      <div style="flex:1;min-width:0">
        <div class="flex-gap" style="margin-bottom:4px"><span class="fw" style="font-size:13px">empty-app-service-plan</span><span class="badge bh">high</span><span class="cat-pill" style="background:rgba(155,124,255,.1);color:var(--pur)">orphaned</span></div>
        <div class="dim" style="font-size:11px">azure.appserviceplan · numberOfSites = 0 · 48h grace period</div>
      </div>
      <button class="tog on" onclick="event.stopPropagation();togglePolicy(this)"></button>
    </div>
  </div>
</div>

<!-- RUNS -->
<div id="pg-runs" class="page">
  <div class="header-row">
    <div>
      <h1>Policy Runs</h1>
      <div class="ph">84 runs in 24h · <span class="grn">79 completed</span> · <span class="red">3 failed</span> · <span class="acct">2 running</span></div>
    </div>
    <div class="flex-gap">
      <button class="btn btn-g" onclick="showTriggerPanel()">Select policies</button>
      <button class="btn btn-p" onclick="triggerAll()">
        <svg width="11" height="11" viewBox="0 0 12 12"><polygon points="2,1 11,6 2,11" fill="#000"/></svg>
        Trigger all
      </button>
    </div>
  </div>
  <div id="trigger-panel" style="display:none;margin-bottom:16px">
    <div class="card">
      <div class="card-hd">Trigger runs</div>
      <div class="g2eq" style="margin-bottom:14px">
        <div>
          <div class="fld"><label>Policies</label>
            <div style="display:flex;flex-direction:column;gap:6px;max-height:150px;overflow-y:auto;padding:4px 0">
              <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-family:var(--fb);font-size:12px;text-transform:none;letter-spacing:0;color:var(--tx);margin:0"><input type="checkbox" checked style="width:auto"/> idle-vm-notify</label>
              <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-family:var(--fb);font-size:12px;text-transform:none;letter-spacing:0;color:var(--tx);margin:0"><input type="checkbox" checked style="width:auto"/> unattached-managed-disk</label>
              <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-family:var(--fb);font-size:12px;text-transform:none;letter-spacing:0;color:var(--tx);margin:0"><input type="checkbox" checked style="width:auto"/> missing-required-tags</label>
              <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-family:var(--fb);font-size:12px;text-transform:none;letter-spacing:0;color:var(--tx);margin:0"><input type="checkbox" checked style="width:auto"/> old-blobs-in-hot-tier</label>
            </div>
          </div>
        </div>
        <div>
          <div class="fld"><label>Subscriptions</label>
            <div style="display:flex;flex-direction:column;gap:6px;padding:4px 0">
              <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-family:var(--fb);font-size:12px;text-transform:none;letter-spacing:0;color:var(--tx);margin:0"><input type="checkbox" checked style="width:auto"/> Production West Europe</label>
              <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-family:var(--fb);font-size:12px;text-transform:none;letter-spacing:0;color:var(--tx);margin:0"><input type="checkbox" checked style="width:auto"/> Staging UK South</label>
              <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-family:var(--fb);font-size:12px;text-transform:none;letter-spacing:0;color:var(--tx);margin:0"><input type="checkbox" style="width:auto"/> Dev North Europe</label>
            </div>
          </div>
        </div>
      </div>
      <div class="flex-gap">
        <button class="btn btn-p" onclick="triggerAll()"><svg width="11" height="11" viewBox="0 0 12 12"><polygon points="2,1 11,6 2,11" fill="#000"/></svg>Launch</button>
        <button class="btn btn-g" onclick="document.getElementById('trigger-panel').style.display='none'">Cancel</button>
      </div>
    </div>
  </div>
  <div class="card" style="padding:0;overflow:hidden">
    <div class="tbl-wrap"><table>
      <thead><tr><th>Status</th><th>Run ID</th><th>Policy</th><th>Subscription</th><th>Resources</th><th>Waste/mo</th><th>Created</th><th></th></tr></thead>
      <tbody id="runs-tbody">
        <tr><td><div class="status-row"><div class="dot dot-run"></div>running</div></td><td class="mono dim" style="font-size:10px">3f8a1c92…</td><td class="fw">idle-vm-notify</td><td style="font-size:11px">prod-westeurope</td><td>—</td><td>—</td><td class="mono dim" style="font-size:10px">14 Mar 11:42</td><td><button class="btn btn-sm btn-d" onclick="cancelRun(this)">Cancel</button></td></tr>
        <tr><td><div class="status-row"><div class="dot dot-run"></div>running</div></td><td class="mono dim" style="font-size:10px">8b21ee4a…</td><td class="fw">unattached-disk</td><td style="font-size:11px">staging-uksouth</td><td>—</td><td>—</td><td class="mono dim" style="font-size:10px">14 Mar 11:42</td><td><button class="btn btn-sm btn-d" onclick="cancelRun(this)">Cancel</button></td></tr>
        <tr><td><div class="status-row"><div class="dot dot-ok"></div>completed</div></td><td class="mono dim" style="font-size:10px">a71f003e…</td><td class="fw">idle-vm-notify</td><td style="font-size:11px">dev-northeurope</td><td class="fw">23</td><td class="mono red fw">£2,140</td><td class="mono dim" style="font-size:10px">14 Mar 10:00</td><td></td></tr>
        <tr><td><div class="status-row"><div class="dot dot-ok"></div>completed</div></td><td class="mono dim" style="font-size:10px">c329b814…</td><td class="fw">old-blobs-hot-tier</td><td style="font-size:11px">staging-uksouth</td><td class="fw">8</td><td class="mono red fw">£560</td><td class="mono dim" style="font-size:10px">14 Mar 10:00</td><td></td></tr>
        <tr><td><div class="status-row"><div class="dot dot-err"></div>failed</div></td><td class="mono dim" style="font-size:10px">09ff4471…</td><td class="fw">missing-required-tags</td><td style="font-size:11px">prod-eastus</td><td>—</td><td>—</td><td class="mono dim" style="font-size:10px">14 Mar 02:00</td><td></td></tr>
        <tr><td><div class="status-row"><div class="dot dot-ok"></div>completed</div></td><td class="mono dim" style="font-size:10px">7e2c9a05…</td><td class="fw">idle-vm-notify</td><td style="font-size:11px">prod-westeurope</td><td class="fw">41</td><td class="mono red fw">£4,880</td><td class="mono dim" style="font-size:10px">13 Mar 02:00</td><td></td></tr>
        <tr><td><div class="status-row"><div class="dot dot-ok"></div>completed</div></td><td class="mono dim" style="font-size:10px">ee19c3ab…</td><td class="fw">unattached-public-ip</td><td style="font-size:11px">prod-westeurope</td><td class="fw">12</td><td class="mono red fw">£48</td><td class="mono dim" style="font-size:10px">13 Mar 02:00</td><td></td></tr>
      </tbody>
    </table></div>
  </div>
</div>

<!-- ACTIONS -->
<div id="pg-actions" class="page">
  <h1>Remediation Actions</h1>
  <div class="ph">Full audit log of all automated and manual remediation actions</div>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-lbl">Completed</div><div class="kpi-val grn" id="act-completed">1,198</div><div class="kpi-bar" style="background:var(--grn)"></div></div>
    <div class="kpi"><div class="kpi-lbl">Running</div><div class="kpi-val acct" id="act-running">4</div><div class="kpi-bar" style="background:var(--ac)"></div></div>
    <div class="kpi"><div class="kpi-lbl">Pending</div><div class="kpi-val amb" id="act-pending">18</div><div class="kpi-bar" style="background:var(--amb)"></div></div>
    <div class="kpi"><div class="kpi-lbl">Failed</div><div class="kpi-val red" id="act-failed">20</div><div class="kpi-bar" style="background:var(--red)"></div></div>
  </div>
  <div class="card" style="padding:0;overflow:hidden">
    <div class="tbl-wrap"><table>
      <thead><tr><th>Status</th><th>Action</th><th>Resource</th><th>Subscription</th><th>By</th><th>Result</th><th>Time</th></tr></thead>
      <tbody id="actions-tbody">
        <tr><td><div class="status-row"><div class="dot dot-run"></div>running</div></td><td><span class="badge bm">deallocate</span></td><td class="fw">vm-prod-worker-03</td><td style="font-size:11px">prod-westeurope</td><td><span class="tag-chip acct">manual</span></td><td>—</td><td class="mono dim" style="font-size:10px">14 Mar 11:43</td></tr>
        <tr><td><div class="status-row"><div class="dot dot-ok"></div>completed</div></td><td><span class="badge bc">delete</span></td><td class="fw">disk-orphan-42</td><td style="font-size:11px">dev-northeurope</td><td><span class="tag-chip">system</span></td><td class="grn mono" style="font-size:11px">deleted ok</td><td class="mono dim" style="font-size:10px">14 Mar 10:12</td></tr>
        <tr><td><div class="status-row"><div class="dot dot-ok"></div>completed</div></td><td><span class="badge bg">tier_down</span></td><td class="fw">storage-logs-archive</td><td style="font-size:11px">staging-uksouth</td><td><span class="tag-chip">system</span></td><td class="grn mono" style="font-size:11px">tier: Cool</td><td class="mono dim" style="font-size:10px">14 Mar 10:08</td></tr>
        <tr><td><div class="status-row"><div class="dot dot-err"></div>failed</div></td><td><span class="badge bm">deallocate</span></td><td class="fw">vm-legacy-batch</td><td style="font-size:11px">prod-westeurope</td><td><span class="tag-chip">system</span></td><td class="red" style="font-size:11px">AuthorizationFailed</td><td class="mono dim" style="font-size:10px">13 Mar 06:30</td></tr>
        <tr><td><div class="status-row"><div class="dot dot-ok"></div>completed</div></td><td><span class="badge bh">tag</span></td><td class="fw">vm-api-gateway-01</td><td style="font-size:11px">prod-westeurope</td><td><span class="tag-chip">system</span></td><td class="grn mono" style="font-size:11px">tagged</td><td class="mono dim" style="font-size:10px">13 Mar 02:01</td></tr>
        <tr><td><div class="status-row"><div class="dot dot-ok"></div>completed</div></td><td><span class="badge bc">delete</span></td><td class="fw">pip-old-gateway</td><td style="font-size:11px">prod-westeurope</td><td><span class="tag-chip">system</span></td><td class="grn mono" style="font-size:11px">deleted ok</td><td class="mono dim" style="font-size:10px">12 Mar 02:00</td></tr>
      </tbody>
    </table></div>
  </div>
</div>

<!-- SETTINGS -->
<div id="pg-settings" class="page">
  <h1>Settings</h1>
  <div class="ph">Manage Azure subscriptions and KEDA worker configuration</div>

  <section style="margin-bottom:28px">
    <div style="font-family:var(--fs);font-weight:600;font-size:15px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:8px">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="1" width="13" height="13" rx="2" stroke="var(--ac)" stroke-width="1.3"/><rect x="3.5" y="3.5" width="8" height="8" rx="1" stroke="var(--ac)" stroke-width="1"/></svg>
        Azure subscriptions
      </div>
      <div class="flex-gap">
        <button class="btn btn-g btn-sm" onclick="toggleSubMethod('form')" id="btn-form-method" style="border-color:var(--ac);color:var(--ac)">Manual entry</button>
        <button class="btn btn-g btn-sm" onclick="toggleSubMethod('yaml')" id="btn-yaml-method">Import YAML</button>
      </div>
    </div>

    <!-- Method A: Manual form -->
    <div id="sub-form-panel" class="card" style="margin-bottom:12px">
      <div style="font-size:12px;font-weight:600;color:var(--tx);margin-bottom:12px">Add subscription — manual entry</div>
      <div class="g2-form" style="margin-bottom:12px">
        <div class="fld"><label>Display name</label><input type="text" id="sub-name" placeholder="Production West Europe"/></div>
        <div class="fld"><label>Subscription ID (GUID)</label><input type="text" id="sub-id" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" class="mono" style="font-size:11px"/></div>
        <div class="fld"><label>Tenant ID (GUID)</label><input type="text" id="sub-tenant" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" class="mono" style="font-size:11px"/></div>
        <div class="fld"><label>Environment</label>
          <select id="sub-env">
            <option value="production">Production</option>
            <option value="staging">Staging</option>
            <option value="development">Development</option>
            <option value="sandbox">Sandbox</option>
          </select>
        </div>
      </div>
      <div id="sub-form-error" style="display:none;font-size:12px;color:var(--red);margin-bottom:10px;padding:8px 10px;background:rgba(255,78,106,.08);border-radius:5px;border:1px solid rgba(255,78,106,.2)"></div>
      <button class="btn btn-p" onclick="addSubFromForm()">+ Add subscription</button>
    </div>

    <!-- Method B: YAML import -->
    <div id="sub-yaml-panel" class="card" style="margin-bottom:12px;display:none">
      <div style="font-size:12px;font-weight:600;color:var(--tx);margin-bottom:6px">Add subscriptions — YAML import</div>
      <div style="font-size:11px;color:var(--tx3);margin-bottom:10px">Paste a YAML block or upload a <code style="font-family:var(--fm);background:var(--bg3);padding:1px 5px;border-radius:3px">.yml</code> file. Multiple subscriptions supported.</div>
      <div style="font-size:10px;color:var(--tx3);font-family:var(--fm);margin-bottom:6px">Expected format:</div>
      <pre style="font-size:10px;font-family:var(--fm);color:var(--tx3);background:var(--bg3);padding:10px 12px;border-radius:6px;margin-bottom:10px;border:1px solid var(--bd);line-height:1.7">subscriptions:
  - name: Production West Europe
    subscription_id: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    tenant_id: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    environment: production
    enabled: true
  - name: Staging UK South
    subscription_id: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    tenant_id: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    environment: staging</pre>
      <textarea id="sub-yaml-input" style="height:160px;font-family:var(--fm);font-size:11px;line-height:1.6;margin-bottom:10px" placeholder="Paste YAML here…"></textarea>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
        <label class="btn btn-g btn-sm" style="cursor:pointer;display:inline-flex;align-items:center;gap:5px">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 5l3 3 3-3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M1 9v1a1 1 0 001 1h8a1 1 0 001-1V9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          Upload .yml file
          <input type="file" accept=".yml,.yaml" style="display:none" onchange="loadYamlFile(this)"/>
        </label>
        <button class="btn btn-g btn-sm" onclick="document.getElementById('sub-yaml-input').value=''">Clear</button>
      </div>
      <div id="sub-yaml-error" style="display:none;font-size:12px;color:var(--red);margin-bottom:10px;padding:8px 10px;background:rgba(255,78,106,.08);border-radius:5px;border:1px solid rgba(255,78,106,.2)"></div>
      <div id="sub-yaml-preview" style="display:none;margin-bottom:10px"></div>
      <div class="flex-gap">
        <button class="btn btn-g btn-sm" onclick="previewYamlSubs()">Preview</button>
        <button class="btn btn-p" onclick="importYamlSubs()">Import subscriptions</button>
      </div>
    </div>

    <!-- Live subscription list -->
    <div class="card" style="padding:0;overflow:hidden" id="sub-list-card">
      <div id="sub-list-body">
        <!-- rendered by renderSubList() -->
      </div>
      <div id="sub-list-empty" style="display:none;padding:28px;text-align:center;color:var(--tx3);font-size:13px">No subscriptions added yet.</div>
    </div>
  </section>

  <section style="margin-bottom:28px">
    <div style="font-family:var(--fs);font-weight:600;font-size:15px;margin-bottom:12px;display:flex;align-items:center;gap:8px">
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6" stroke="var(--ac)" stroke-width="1.3"/><path d="M7.5 4.5v3l2 2" stroke="var(--ac)" stroke-width="1.3" stroke-linecap="round"/></svg>
      KEDA worker configuration
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <div class="card"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px"><span class="mono acct" style="font-size:12px">worker-policy-runs</span><div class="flex-gap"><span class="tag-chip acct">0→20 replicas</span><span class="tag-chip">concurrency: 4</span></div></div><div style="font-size:12px;color:var(--tx2);margin-bottom:5px">Executes Cloud Custodian policy scans against Azure subscriptions. Each task is isolated in its own container.</div><div class="mono dim" style="font-size:10px">trigger: azure-queue · queue: custodian-policy-runs · cooldown: 120s · poll: 15s</div></div>
      <div class="card"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px"><span class="mono pur" style="font-size:12px">worker-remediation</span><div class="flex-gap"><span class="tag-chip pur">0→10 replicas</span><span class="tag-chip">concurrency: 2</span></div></div><div style="font-size:12px;color:var(--tx2);margin-bottom:5px">Applies Azure SDK actions: deallocate, delete, resize, snapshot, tier-down against identified waste resources.</div><div class="mono dim" style="font-size:10px">trigger: azure-queue · queue: custodian-remediation · cooldown: 180s · poll: 15s</div></div>
      <div class="card"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px"><span class="mono amb" style="font-size:12px">worker-notifications</span><div class="flex-gap"><span class="tag-chip amb">0→5 replicas</span><span class="tag-chip">concurrency: 4</span></div></div><div style="font-size:12px;color:var(--tx2);margin-bottom:5px">Sends email, Teams, and PagerDuty alerts to resource owners when resources enter the remediation ladder.</div><div class="mono dim" style="font-size:10px">trigger: azure-queue · queue: custodian-notifications · cooldown: 60s · poll: 15s</div></div>
      <div class="card"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px"><span class="mono grn" style="font-size:12px">worker-beat</span><div class="flex-gap"><span class="tag-chip grn">always 1 replica</span></div></div><div style="font-size:12px;color:var(--tx2);margin-bottom:5px">Celery Beat scheduler. Emits scheduled policy triggers. Never scaled to 0 — must always be running.</div><div class="mono dim" style="font-size:10px">hourly: idle · daily 02:00: tagging · weekly Mon 03:00: right-size / storage / orphaned</div></div>
    </div>
  </section>
</div>

</main>
</div>



<!-- TOAST -->
<div id="toast"></div>

<script>
// ── Timestamp ──────────────────────────────────────────────────────
document.getElementById('ts').textContent = new Date().toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});

// ── Navigation ──────────────────────────────────────────────────────
function goPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.ni').forEach(n => n.classList.remove('on'));
  document.getElementById('pg-' + id).classList.add('on');
  btn.classList.add('on');
  if (id === 'analytics') setTimeout(initAnalyticsCharts, 50);
}

// ── Charts ─────────────────────────────────────────────────────────
const CO = '#00d4ff', CR = '#ff4e6a', CG = '#00e5a0', CA = '#ffb547', CP = '#9b7cff';
const chartDefaults = {
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#151a22', borderColor: '#232d3f', borderWidth: 1,
      titleColor: '#8896b0', bodyColor: '#e2e8f4',
      titleFont: { family: "'DM Mono',monospace", size: 10 },
      bodyFont: { family: "'DM Mono',monospace", size: 11 },
    }
  },
  scales: {
    x: { grid: { color: '#1c2330' }, ticks: { color: '#4a5878', font: { family: "'DM Mono',monospace", size: 10 } } },
    y: { grid: { color: '#1c2330' }, ticks: { color: '#4a5878', font: { family: "'DM Mono',monospace", size: 10 } } }
  }
};

const days14 = Array.from({length:14},(_,i)=>{const d=new Date();d.setDate(d.getDate()-13+i);return d.toLocaleDateString('en-GB',{month:'short',day:'numeric'})});
const waste14 = [2100,3400,2800,4200,3100,5600,4800,7200,6100,8400,7800,9200,11400,12800];

new Chart(document.getElementById('c-trend'), {
  type:'line',
  data:{labels:days14,datasets:[{data:waste14,borderColor:CR,borderWidth:2,fill:true,backgroundColor:'rgba(255,78,106,.08)',tension:.4,pointRadius:0}]},
  options:chartDefaults
});

new Chart(document.getElementById('c-cat'), {
  type:'bar',
  data:{labels:['idle','orphaned','right-size','tagging','storage'],datasets:[{data:[22400,8200,11300,3100,2280],backgroundColor:[CR,CA,CP,CO,CG],borderRadius:4}]},
  options:{...chartDefaults,indexAxis:'y'}
});

let analyticsInited = false;
function initAnalyticsCharts() {
  if (analyticsInited) return;
  analyticsInited = true;
  const days30 = Array.from({length:30},(_,i)=>{const d=new Date();d.setDate(d.getDate()-29+i);return d.toLocaleDateString('en-GB',{month:'short',day:'numeric'})});
  const waste30 = [1200,900,2100,1800,3200,2400,4100,3600,5200,4800,6100,5400,7200,6800,8100,7600,9200,8800,10400,9600,11800,10200,12400,11600,13200,12800,14100,13600,15200,14800];

  new Chart(document.getElementById('c-trend30'),{type:'line',data:{labels:days30,datasets:[{data:waste30,borderColor:CR,borderWidth:2,fill:true,backgroundColor:'rgba(255,78,106,.07)',tension:.4,pointRadius:0}]},options:chartDefaults});

  new Chart(document.getElementById('c-ladder'),{type:'doughnut',data:{labels:['notify','tagged','deallocated','deleted','exempt'],datasets:[{data:[142,80,54,26,10],backgroundColor:['#4a5878',CA,CP,CR,CG],borderWidth:2,borderColor:'#0f1217'}]},options:{plugins:{legend:{display:true,position:'right',labels:{color:'#8896b0',font:{family:"'DM Mono',monospace",size:10},boxWidth:10,padding:8}}}}});

  new Chart(document.getElementById('c-cat2'),{type:'bar',data:{labels:['idle','orphaned','right-size','tagging','storage'],datasets:[{data:[22400,8200,11300,3100,2280],backgroundColor:[CR,CA,CP,CO,CG],borderRadius:4}]},options:chartDefaults});

  new Chart(document.getElementById('c-sev'),{type:'bar',data:{labels:['critical','high','medium','low'],datasets:[{data:[48,92,124,48],backgroundColor:[CR,CA,CP,CO],borderRadius:4}]},options:chartDefaults});

  new Chart(document.getElementById('c-runs'),{type:'line',data:{labels:days14,datasets:[{label:'runs',data:[18,22,19,24,21,28,25,30,27,32,29,34,31,36],borderColor:CO,borderWidth:2,tension:.4,pointRadius:0,fill:false},{label:'resources',data:[45,62,51,78,63,94,82,108,91,124,113,138,121,156],borderColor:CA,borderWidth:2,tension:.4,pointRadius:0,fill:false}]},options:{...chartDefaults,plugins:{...chartDefaults.plugins,legend:{display:true,labels:{color:'#8896b0',font:{family:"'DM Mono',monospace",size:10},boxWidth:10}}}}});
}

// ── Resource filters ─────────────────────────────────────────────
let activeCat = 'all', activeLadder = '';
function filterCat(btn) {
  document.querySelectorAll('#res-pills .pill').forEach(p => p.classList.remove('on'));
  btn.classList.add('on');
  activeCat = btn.dataset.filter;
  activeLadder = '';
  applyResFilter();
}
function filterLadder(btn) {
  const wasOn = btn.classList.contains('on');
  document.querySelectorAll('#res-pills .pill').forEach(p => p.classList.remove('on'));
  if (!wasOn) { btn.classList.add('on'); activeLadder = btn.dataset.filter; }
  else activeLadder = '';
  activeCat = 'all';
  applyResFilter();
}
function applyResFilter() {
  document.querySelectorAll('#res-tbody tr[data-cat]').forEach(r => {
    const catOk = activeCat === 'all' || r.dataset.cat === activeCat;
    const ladderOk = !activeLadder || r.dataset.ladder === activeLadder;
    r.style.display = catOk && ladderOk ? '' : 'none';
  });
}
function searchRes(val) {
  document.querySelectorAll('#res-tbody tr[data-name]').forEach(r => {
    r.style.display = r.dataset.name.toLowerCase().includes(val.toLowerCase()) ? '' : 'none';
  });
}

// ── Action menus ─────────────────────────────────────────────────
document.addEventListener('click', e => {
  if (!e.target.closest('.act-wrap')) {
    document.querySelectorAll('.act-menu').forEach(m => m.style.display = 'none');
  }
});
function toggleMenu(btn) {
  const menu = btn.nextElementSibling;
  const wasOpen = menu.style.display === 'block';
  document.querySelectorAll('.act-menu').forEach(m => m.style.display = 'none');
  menu.style.display = wasOpen ? 'none' : 'block';
}
function doAction(action, name, btn) {
  btn.closest('.act-menu').style.display = 'none';
  toast(`${action} queued for ${name}`);
  const tr = btn.closest('tr');
  const actionColors = { Deallocate: '#9b7cff', Delete: '#ff4e6a', 'Tier-down to Cool': '#00e5a0', 'Resize to B2s': '#00e5a0', 'Tag for deletion': '#ffb547', Snapshot: '#00d4ff' };
  addActionRow(action.toLowerCase().replace(' ','_'), name, actionColors[action] || '#9b7cff');
  if (action === 'Delete') { setTimeout(() => { tr.style.opacity = '0.3'; tr.style.transition = 'opacity .5s'; }, 1500); }
}
function markExempt(name, btn) {
  btn.closest('.act-menu').style.display = 'none';
  const tr = btn.closest('tr');
  tr.style.opacity = '0.4';
  toast(`${name} marked exempt — excluded from all ladder actions`);
}
function addActionRow(type, name, color) {
  const tbody = document.getElementById('actions-tbody');
  const now = new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  const row = document.createElement('tr');
  row.innerHTML = `<td><div class="status-row"><div class="dot dot-run"></div>running</div></td><td><span class="badge bm" style="color:${color};background:${color}18">${type}</span></td><td class="fw">${name}</td><td style="font-size:11px">prod-westeurope</td><td><span class="tag-chip acct">manual</span></td><td>—</td><td class="mono dim" style="font-size:10px">14 Mar ${now}</td>`;
  tbody.insertBefore(row, tbody.firstChild);
  document.getElementById('act-running').textContent = parseInt(document.getElementById('act-running').textContent) + 1;
  setTimeout(() => {
    row.cells[0].innerHTML = '<div class="status-row"><div class="dot dot-ok"></div>completed</div>';
    row.cells[5].innerHTML = `<span class="grn mono" style="font-size:11px">ok</span>`;
    const n = parseInt(document.getElementById('act-running').textContent);
    document.getElementById('act-running').textContent = Math.max(0, n - 1);
    document.getElementById('act-completed').textContent = parseInt(document.getElementById('act-completed').textContent.replace(',','')) + 1;
  }, 2500);
}

// ── Runs ──────────────────────────────────────────────────────────
function cancelRun(btn) {
  const tr = btn.closest('tr');
  tr.cells[0].innerHTML = '<div class="status-row"><div class="dot dot-off"></div>cancelled</div>';
  btn.remove();
  toast('Run cancelled');
}
function showTriggerPanel() {
  const p = document.getElementById('trigger-panel');
  p.style.display = p.style.display === 'none' ? 'block' : 'none';
}
let runCount = 0;
function triggerAll() {
  document.getElementById('trigger-panel').style.display = 'none';
  runCount++;
  toast(`Spawned 12 policy runs across 3 subscriptions (KEDA scaling workers now…)`);
  const tbody = document.getElementById('runs-tbody');
  const subs = ['prod-westeurope','staging-uksouth','dev-northeurope'];
  const pols = ['idle-vm-notify','unattached-disk','old-blobs-hot-tier','missing-tags'];
  const id = Math.random().toString(36).slice(2,10);
  const sub = subs[runCount % 3];
  const pol = pols[runCount % 4];
  const row = document.createElement('tr');
  const now = new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  row.innerHTML = `<td><div class="status-row"><div class="dot dot-run"></div>running</div></td><td class="mono dim" style="font-size:10px">${id}…</td><td class="fw">${pol}</td><td style="font-size:11px">${sub}</td><td>—</td><td>—</td><td class="mono dim" style="font-size:10px">14 Mar ${now}</td><td><button class="btn btn-sm btn-d" onclick="cancelRun(this)">Cancel</button></td>`;
  tbody.insertBefore(row, tbody.firstChild);
  const res = Math.floor(Math.random() * 30) + 5;
  const waste = res * (Math.floor(Math.random() * 150) + 50);
  setTimeout(() => {
    row.cells[0].innerHTML = '<div class="status-row"><div class="dot dot-ok"></div>completed</div>';
    row.cells[4].innerHTML = `<span class="fw">${res}</span>`;
    row.cells[5].innerHTML = `<span class="mono red fw">£${waste.toLocaleString()}</span>`;
    if (row.cells[7]) row.cells[7].innerHTML = '';
  }, 3000 + Math.random() * 2000);
}

// ── Policies ─────────────────────────────────────────────────────
const DEFAULT_YAML = `policies:
  - name: my-policy
    resource: azure.vm
    filters:
      - type: metric
        name: Percentage CPU
        aggregation: average
        op: less-than
        threshold: 5
        timeframe: 168
      - "tag:custodian_status": absent
    actions:
      - type: tag
        tags:
          custodian_status: "idle-notify"
          custodian_date: "{now}"
`;
const POLICY_YAMLS = {
  'idle-vm-notify': `policies:\n  - name: idle-vm-notify\n    resource: azure.vm\n    filters:\n      - type: metric\n        name: Percentage CPU\n        aggregation: average\n        op: less-than\n        threshold: 5\n        timeframe: 168\n    actions:\n      - type: tag\n        tags:\n          custodian_status: "idle-notify"\n`,
  'unattached-managed-disk': `policies:\n  - name: unattached-managed-disk\n    resource: azure.disk\n    filters:\n      - type: value\n        key: properties.diskState\n        value: Unattached\n    actions:\n      - type: tag\n        tags:\n          custodian_status: "orphaned-disk"\n`,
  'missing-required-tags': `policies:\n  - name: missing-required-tags\n    resource: azure.resourcegroup\n    filters:\n      - or:\n        - "tag:Owner": absent\n        - "tag:Environment": absent\n        - "tag:CostCenter": absent\n    actions:\n      - type: tag\n        tags:\n          custodian_status: "tag-noncompliant"\n`,
};

function openPolicyEditor(name) {
  const editor = document.getElementById('policy-editor');
  const isEdit = !!name;
  document.getElementById('ped-title').textContent = isEdit ? 'Edit: ' + name : 'New policy';
  document.getElementById('pol-name').value = isEdit ? name : '';
  document.getElementById('pol-desc').value = '';
  document.getElementById('pol-yaml').value = isEdit ? (POLICY_YAMLS[name] || DEFAULT_YAML) : DEFAULT_YAML;
  document.getElementById('pol-sched').value = '';
  document.getElementById('pol-grace').value = '72';
  // Reset validation state on open
  document.getElementById('val-panel').style.display = 'none';
  document.getElementById('val-panel').innerHTML = '';
  const sb = document.getElementById('save-btn');
  sb.setAttribute('disabled',''); sb.style.opacity='.4'; sb.style.cursor='not-allowed';
  editor.classList.add('on');
  editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function closePolicyEditor() {
  document.getElementById('policy-editor').classList.remove('on');
}
function editPolicy(name) { openPolicyEditor(name); }
function togglePolicy(btn) {
  btn.classList.toggle('on');
  const card = btn.closest('.card');
  card.style.opacity = btn.classList.contains('on') ? '1' : '0.5';
  toast(btn.classList.contains('on') ? 'Policy enabled' : 'Policy disabled');
}
// ── Policy validator ─────────────────────────────────────────────
const VALID_RESOURCES = ['azure.vm','azure.disk','azure.publicip','azure.sqldatabase',
  'azure.storage','azure.appserviceplan','azure.resourcegroup','azure.cosmosdb',
  'azure.keyvault','azure.networkinterface','azure.vnet','azure.subnet'];
const VALID_FILTER_TYPES = ['value','metric','marked-for-op','age','tag','event'];
const VALID_ACTION_TYPES = ['tag','untag','notify','delete','stop','start',
  'resize','snapshot','set-firewall-rules','logic-app'];
const VALID_OPS = ['eq','ne','gt','ge','lt','le','less-than','greater-than',
  'in','not-in','contains','absent','present','glob','regex'];
const VALID_AGGREGATIONS = ['average','total','minimum','maximum','count'];

function parseYamlBasic(yaml) {
  // Lightweight structural YAML parser — handles the Cloud Custodian subset
  const errors = [], warnings = [], info = [];
  const lines = yaml.split('\n');

  // ── 1. Top-level must start with "policies:"
  const firstNonEmpty = lines.find(l => l.trim() && !l.trim().startsWith('#'));
  if (!firstNonEmpty || firstNonEmpty.trim() !== 'policies:') {
    errors.push({ line: 1, msg: 'YAML must start with a top-level "policies:" key.' });
    return { errors, warnings, info, parsed: null };
  }

  // ── 2. Extract policy blocks by scanning for "  - name:" entries
  const policyStarts = [];
  lines.forEach((l, i) => {
    if (/^\s{2,4}-\s+name:\s*\S/.test(l)) policyStarts.push(i);
  });
  if (policyStarts.length === 0) {
    errors.push({ line: 2, msg: 'No policy entries found. Each policy needs a "name:" field under the policies list.' });
    return { errors, warnings, info, parsed: null };
  }

  info.push(`Found ${policyStarts.length} policy definition${policyStarts.length > 1 ? 's' : ''}.`);

  const policies = [];
  policyStarts.forEach((startLine, pi) => {
    const endLine = policyStarts[pi + 1] || lines.length;
    const block = lines.slice(startLine, endLine);
    const pol = { name: null, resource: null, filters: [], actions: [], _startLine: startLine + 1 };

    block.forEach((l, li) => {
      const abs = startLine + li + 1;
      const t = l.trim();
      if (/name:\s*(.+)/.test(t))     pol.name     = t.replace(/name:\s*/, '').replace(/['"]/g,'').trim();
      if (/resource:\s*(.+)/.test(t)) pol.resource  = t.replace(/resource:\s*/, '').trim();
      if (/^\s*-\s+type:\s*(.+)/.test(l)) {
        const typ = l.match(/type:\s*(.+)/)[1].trim();
        if (block.slice(0, li).some(x => /^\s*filters:/.test(x))) pol.filters.push({ type: typ, line: abs });
        else if (block.slice(0, li).some(x => /^\s*actions:/.test(x))) pol.actions.push({ type: typ, line: abs });
      }
      if (/^\s{8,}-\s+type:\s*tag/.test(l) || /^\s*-\s+type:\s*tag/.test(l)) {
        if (!pol.actions.find(a => a.type === 'tag')) pol.actions.push({ type: 'tag', line: abs });
      }
    });

    // Detect actions block by scanning for simpler patterns too
    let inActions = false, inFilters = false;
    block.forEach((l, li) => {
      const abs = startLine + li + 1;
      if (/^\s{4}actions:/.test(l)) { inActions = true; inFilters = false; }
      if (/^\s{4}filters:/.test(l)) { inFilters = true; inActions = false; }
      if (inActions && /^\s{6,}-\s+type:\s*(\S+)/.test(l)) {
        const m = l.match(/type:\s*(\S+)/);
        if (m && !pol.actions.find(a => a.type === m[1])) pol.actions.push({ type: m[1], line: abs });
      }
    });

    policies.push(pol);
  });

  // ── 3. Per-policy validation
  policies.forEach(pol => {
    const ln = pol._startLine;

    // Name
    if (!pol.name) {
      errors.push({ line: ln, msg: 'Policy is missing a "name:" field.' });
    } else {
      if (!/^[a-z0-9][a-z0-9\-_]*$/.test(pol.name))
        warnings.push({ line: ln, msg: `Policy name "${pol.name}" should use only lowercase letters, numbers, hyphens, and underscores.` });
      if (pol.name.length > 64)
        warnings.push({ line: ln, msg: `Policy name "${pol.name}" is very long (${pol.name.length} chars). Keep under 64.` });
    }

    // Resource
    if (!pol.resource) {
      errors.push({ line: ln, msg: `Policy "${pol.name || 'unnamed'}" is missing a "resource:" field.` });
    } else if (!VALID_RESOURCES.includes(pol.resource)) {
      errors.push({ line: ln, msg: `Unknown resource type "${pol.resource}". Valid Azure types: ${VALID_RESOURCES.join(', ')}.` });
    } else {
      info.push(`Resource type "${pol.resource}" is valid.`);
    }

    // Filters
    if (pol.filters.length === 0) {
      warnings.push({ line: ln, msg: `Policy "${pol.name}" has no filters — it will match ALL resources of this type. Add at least one filter to narrow scope.` });
    } else {
      pol.filters.forEach(f => {
        if (f.type && !VALID_FILTER_TYPES.includes(f.type) && !f.type.startsWith('"') && !f.type.startsWith("'"))
          warnings.push({ line: f.line, msg: `Filter type "${f.type}" is not a standard Cloud Custodian filter. Check spelling.` });
      });
      info.push(`${pol.filters.length} filter${pol.filters.length > 1 ? 's' : ''} defined.`);
    }

    // Actions
    if (pol.actions.length === 0) {
      errors.push({ line: ln, msg: `Policy "${pol.name}" has no "actions:" section. At least one action (e.g. "tag") is required.` });
    } else {
      pol.actions.forEach(a => {
        if (a.type === 'delete')
          warnings.push({ line: a.line, msg: `Action "delete" is destructive. Ensure a grace period and "tag" step precede this in your ladder.` });
        if (a.type === 'stop')
          warnings.push({ line: a.line||ln, msg: `Action "stop" only OS-halts the VM — use "deallocate" to stop Azure billing for compute.` });
      });
      info.push(`${pol.actions.length} action${pol.actions.length > 1 ? 's' : ''}: ${pol.actions.map(a=>a.type).join(', ')}.`);
    }

    // Indentation check
    const badIndent = lines.slice(pol._startLine - 1).findIndex(l => l.length > 0 && !l.startsWith(' ') && !l.startsWith('-') && l.trim() !== 'policies:');
    if (badIndent !== -1 && badIndent < 40) {
      const abs = pol._startLine + badIndent;
      warnings.push({ line: abs, msg: `Possible indentation issue at line ${abs}. Cloud Custodian YAML requires consistent 2-space indentation.` });
    }
  });

  // ── 4. YAML structural checks
  let indentErrors = 0;
  lines.forEach((l, i) => {
    if (l.trim() === '') return;
    const indent = l.match(/^(\s*)/)[1].length;
    if (indent % 2 !== 0 && !l.trim().startsWith('#')) {
      indentErrors++;
      if (indentErrors <= 2)
        warnings.push({ line: i + 1, msg: `Line ${i+1}: odd indentation (${indent} spaces). Use multiples of 2.` });
    }
    if (l.includes('\t'))
      errors.push({ line: i + 1, msg: `Line ${i+1}: tab character found. YAML requires spaces only.` });
  });
  if (indentErrors > 2) warnings.push({ line: 0, msg: `${indentErrors - 2} more indentation warnings suppressed.` });

  // ── 5. Name / resource consistency with form fields
  const formName  = document.getElementById('pol-name').value.trim();
  const formRtype = document.getElementById('pol-rtype').value;
  if (policies.length === 1 && policies[0].name && formName && policies[0].name !== formName) {
    warnings.push({ line: policies[0]._startLine, msg: `YAML policy name "${policies[0].name}" does not match the Name field above ("${formName}"). They should match.` });
  }
  if (policies.length === 1 && policies[0].resource && policies[0].resource !== formRtype) {
    warnings.push({ line: policies[0]._startLine, msg: `YAML resource "${policies[0].resource}" does not match the Resource type field ("${formRtype}"). Update one to match.` });
  }

  return { errors, warnings, info, parsed: policies };
}

function testPolicy() {
  const btn = document.getElementById('test-btn');
  const saveBtn = document.getElementById('save-btn');
  const panel = document.getElementById('val-panel');
  const yaml = document.getElementById('pol-yaml').value.trim();
  const name  = document.getElementById('pol-name').value.trim();

  if (!yaml) { toast('Paste a YAML policy before testing'); return; }

  // Animate test button
  btn.textContent = 'Testing…';
  btn.disabled = true;

  setTimeout(() => {
    btn.innerHTML = '&#9654; Test policy';
    btn.disabled = false;

    const result = parseYamlBasic(yaml);
    const { errors, warnings, info } = result;
    const passed = errors.length === 0;

    // Build result HTML
    let html = '';
    const bg    = passed ? 'rgba(0,229,160,.06)'  : 'rgba(255,78,106,.06)';
    const bdr   = passed ? 'rgba(0,229,160,.25)'  : 'rgba(255,78,106,.3)';
    const hdrC  = passed ? 'var(--grn)'            : 'var(--red)';
    const icon  = passed ? '&#10003;' : '&#10007;';
    const title = passed
      ? (warnings.length ? `Passed with ${warnings.length} warning${warnings.length>1?'s':''}` : 'Validation passed')
      : `Validation failed — ${errors.length} error${errors.length>1?'s':''}`;

    html += `<div style="background:${bg};border:1px solid ${bdr};border-radius:7px;padding:14px 16px">`;
    html += `<div style="font-family:var(--fm);font-size:13px;font-weight:600;color:${hdrC};margin-bottom:${(errors.length+warnings.length+info.length)>0?'12px':'0'}">${icon} ${title}</div>`;

    if (errors.length) {
      html += `<div style="margin-bottom:10px">`;
      html += `<div style="font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--red);font-family:var(--fm);margin-bottom:6px">Errors</div>`;
      errors.forEach(e => {
        html += `<div style="display:flex;gap:8px;margin-bottom:5px;align-items:flex-start">`;
        html += `<span style="background:rgba(255,78,106,.15);color:var(--red);font-family:var(--fm);font-size:10px;padding:1px 6px;border-radius:3px;flex-shrink:0;margin-top:1px">${e.line ? 'L'+e.line : 'ERR'}</span>`;
        html += `<span style="font-size:12px;color:var(--tx2);line-height:1.5">${e.msg}</span></div>`;
      });
      html += `</div>`;
    }

    if (warnings.length) {
      html += `<div style="margin-bottom:10px">`;
      html += `<div style="font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--amb);font-family:var(--fm);margin-bottom:6px">Warnings</div>`;
      warnings.forEach(w => {
        html += `<div style="display:flex;gap:8px;margin-bottom:5px;align-items:flex-start">`;
        html += `<span style="background:rgba(255,181,71,.15);color:var(--amb);font-family:var(--fm);font-size:10px;padding:1px 6px;border-radius:3px;flex-shrink:0;margin-top:1px">${w.line ? 'L'+w.line : 'WARN'}</span>`;
        html += `<span style="font-size:12px;color:var(--tx2);line-height:1.5">${w.msg}</span></div>`;
      });
      html += `</div>`;
    }

    if (info.length) {
      html += `<div>`;
      html += `<div style="font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--tx3);font-family:var(--fm);margin-bottom:6px">Details</div>`;
      info.forEach(m => {
        html += `<div style="display:flex;gap:8px;margin-bottom:4px;align-items:flex-start">`;
        html += `<span style="color:var(--ac);font-size:12px;flex-shrink:0;margin-top:2px">&#8250;</span>`;
        html += `<span style="font-size:12px;color:var(--tx3);line-height:1.5">${m}</span></div>`;
      });
      html += `</div>`;
    }

    html += `</div>`;
    panel.innerHTML = html;
    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Enable / disable Save
    if (passed) {
      saveBtn.removeAttribute('disabled');
      saveBtn.style.opacity = '1';
      saveBtn.style.cursor = 'pointer';
    } else {
      saveBtn.setAttribute('disabled', '');
      saveBtn.style.opacity = '.4';
      saveBtn.style.cursor = 'not-allowed';
    }
  }, 900);
}

function savePolicy() {
  const name = document.getElementById('pol-name').value.trim();
  if (!name) { toast('Policy name is required'); document.getElementById('pol-name').focus(); return; }
  const yaml = document.getElementById('pol-yaml').value.trim();
  if (!yaml) { toast('Policy YAML is required'); return; }
  closePolicyEditor();
  toast(`Policy "${name}" saved`);
  const cat   = document.getElementById('pol-cat').value;
  const sev   = document.getElementById('pol-sev').value;
  const rtype = document.getElementById('pol-rtype').value;
  const grace = document.getElementById('pol-grace').value;
  const desc  = document.getElementById('pol-desc').value;
  const catColors = { idle:'var(--red)', orphaned:'var(--amb)', 'right-size':'var(--pur)', tagging:'var(--ac)', storage:'var(--grn)' };
  const sevClass  = { low:'bl', medium:'bm', high:'bh', critical:'bc' };
  const catBg     = { idle:'rgba(255,78,106,.1)', orphaned:'rgba(255,181,71,.1)', 'right-size':'rgba(155,124,255,.1)', tagging:'rgba(0,212,255,.1)', storage:'rgba(0,229,160,.1)' };
  const list = document.getElementById('pol-list');
  const div = document.createElement('div');
  div.className = 'card';
  div.style.cssText = 'display:flex;align-items:center;gap:14px;cursor:pointer;padding:14px 18px';
  div.onclick = () => openPolicyEditor(name);
  div.innerHTML = `<div style="width:4px;height:42px;border-radius:2px;background:${catColors[cat]};flex-shrink:0"></div><div style="flex:1;min-width:0"><div class="flex-gap" style="margin-bottom:4px"><span class="fw" style="font-size:13px">${name}</span><span class="badge ${sevClass[sev]}">${sev}</span><span class="cat-pill" style="background:${catBg[cat]};color:${catColors[cat]}">${cat}</span></div><div class="dim" style="font-size:11px">${rtype} · ${desc||'No description'} · ${grace}h grace period</div></div><button class="tog on" onclick="event.stopPropagation();togglePolicy(this)"></button>`;
  list.insertBefore(div, list.firstChild);
}

// ── Toast ─────────────────────────────────────────────────────────
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// ── Subscriptions ─────────────────────────────────────────────────────────────
const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let subscriptions = [
  { id: 's1', name: 'Production West Europe', subscription_id: '9a2f8c1d-0001-0001-0001-000000000001', tenant_id: 'tenant-0001-0001-0001-000000000001', environment: 'production',  enabled: true  },
  { id: 's2', name: 'Staging UK South',       subscription_id: '4bc1a007-0002-0002-0002-000000000002', tenant_id: 'tenant-0002-0002-0002-000000000002', environment: 'staging',     enabled: true  },
  { id: 's3', name: 'Dev North Europe',       subscription_id: 'c7f9e231-0003-0003-0003-000000000003', tenant_id: 'tenant-0003-0003-0003-000000000003', environment: 'development', enabled: false },
];

const ENV_COLOR = { production:'var(--red)', staging:'var(--amb)', development:'var(--ac)', sandbox:'var(--pur)' };
const ENV_BG    = { production:'rgba(255,78,106,.1)', staging:'rgba(255,181,71,.1)', development:'rgba(0,212,255,.1)', sandbox:'rgba(155,124,255,.1)' };

function renderSubList() {
  const body  = document.getElementById('sub-list-body');
  const empty = document.getElementById('sub-list-empty');
  if (!subscriptions.length) { body.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  body.innerHTML = subscriptions.map((s, i) => `
    <div style="display:flex;align-items:center;gap:12px;padding:13px 16px;${i < subscriptions.length-1 ? 'border-bottom:1px solid var(--bd)' : ''};opacity:${s.enabled ? 1 : 0.5};transition:opacity .2s">
      <div style="width:7px;height:7px;border-radius:50%;background:${s.enabled ? 'var(--grn)' : 'var(--tx3)'};flex-shrink:0"></div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
          <span class="fw" style="font-size:13px">${s.name}</span>
          <span style="font-size:10px;font-family:var(--fm);padding:1px 7px;border-radius:3px;background:${ENV_BG[s.environment]||'var(--bg3)'};color:${ENV_COLOR[s.environment]||'var(--tx2)'}">${s.environment}</span>
        </div>
        <div class="mono dim" style="font-size:10px">sub: ${s.subscription_id} · tenant: ${s.tenant_id}</div>
      </div>
      <div class="flex-gap">
        <button class="tog ${s.enabled ? 'on' : ''}" onclick="toggleSub('${s.id}')"></button>
        <button class="btn btn-g btn-sm" style="color:var(--red);border-color:rgba(255,78,106,.3)" onclick="removeSub('${s.id}')">✕</button>
      </div>
    </div>`).join('');
}

function toggleSub(id) {
  const s = subscriptions.find(x => x.id === id);
  if (!s) return;
  s.enabled = !s.enabled;
  renderSubList();
  toast(`${s.name} ${s.enabled ? 'enabled' : 'disabled'}`);
}

function removeSub(id) {
  const s = subscriptions.find(x => x.id === id);
  if (!s) return;
  if (!confirm(`Remove "${s.name}"?`)) return;
  subscriptions = subscriptions.filter(x => x.id !== id);
  renderSubList();
  toast(`Removed ${s.name}`);
}

function toggleSubMethod(method) {
  const formPanel  = document.getElementById('sub-form-panel');
  const yamlPanel  = document.getElementById('sub-yaml-panel');
  const btnForm    = document.getElementById('btn-form-method');
  const btnYaml    = document.getElementById('btn-yaml-method');
  const isForm = method === 'form';
  formPanel.style.display = isForm ? 'block' : 'none';
  yamlPanel.style.display = isForm ? 'none'  : 'block';
  btnForm.style.borderColor = isForm ? 'var(--ac)' : 'var(--bd)';
  btnForm.style.color       = isForm ? 'var(--ac)' : 'var(--tx2)';
  btnYaml.style.borderColor = isForm ? 'var(--bd)' : 'var(--ac)';
  btnYaml.style.color       = isForm ? 'var(--tx2)' : 'var(--ac)';
  document.getElementById('sub-form-error').style.display = 'none';
  document.getElementById('sub-yaml-error').style.display = 'none';
  document.getElementById('sub-yaml-preview').style.display = 'none';
}

function showSubError(panelId, msg) {
  const el = document.getElementById(panelId);
  el.textContent = msg;
  el.style.display = 'block';
}

function validateGuid(v, label) {
  if (!v) return `${label} is required`;
  if (!GUID_RE.test(v.trim())) return `${label} must be a valid GUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)`;
  return null;
}

function addSubFromForm() {
  document.getElementById('sub-form-error').style.display = 'none';
  const name    = document.getElementById('sub-name').value.trim();
  const subId   = document.getElementById('sub-id').value.trim();
  const tenant  = document.getElementById('sub-tenant').value.trim();
  const env     = document.getElementById('sub-env').value;

  if (!name) return showSubError('sub-form-error', 'Display name is required.');
  const guidErr = validateGuid(subId, 'Subscription ID') || validateGuid(tenant, 'Tenant ID');
  if (guidErr) return showSubError('sub-form-error', guidErr);
  if (subscriptions.find(s => s.subscription_id.toLowerCase() === subId.toLowerCase()))
    return showSubError('sub-form-error', `Subscription ID ${subId} is already registered.`);

  subscriptions.push({ id: 's' + Date.now(), name, subscription_id: subId, tenant_id: tenant, environment: env, enabled: true });
  renderSubList();
  document.getElementById('sub-name').value = '';
  document.getElementById('sub-id').value = '';
  document.getElementById('sub-tenant').value = '';
  toast(`"${name}" added successfully`);
}

function parseSubYaml(yaml) {
  const errors = [], parsed = [];
  if (!yaml.trim()) return { errors: ['YAML is empty'], parsed };
  if (!yaml.includes('subscriptions:')) return { errors: ['YAML must contain a top-level "subscriptions:" key'], parsed };

  const blocks = yaml.split(/\n\s*-\s+/).slice(1);
  if (!blocks.length) return { errors: ['No subscription entries found under "subscriptions:"'], parsed };

  blocks.forEach((block, i) => {
    const num = i + 1;
    const get = (key) => { const m = block.match(new RegExp(key + ':\\s*["\']?([^\\n\'"]+)["\']?')); return m ? m[1].trim() : ''; };
    const name   = get('name');
    const subId  = get('subscription_id');
    const tenant = get('tenant_id');
    const env    = get('environment') || 'production';
    const enabled = get('enabled') !== 'false';

    if (!name)   errors.push(`Entry ${num}: "name" is missing`);
    const guidErr = validateGuid(subId, `Entry ${num} subscription_id`) || validateGuid(tenant, `Entry ${num} tenant_id`);
    if (guidErr) errors.push(guidErr);
    else if (name) {
      if (subscriptions.find(s => s.subscription_id.toLowerCase() === subId.toLowerCase()))
        errors.push(`Entry ${num} (${name}): subscription_id already registered — skipping`);
      else
        parsed.push({ id: 's' + Date.now() + i, name, subscription_id: subId, tenant_id: tenant, environment: env, enabled });
    }
  });
  return { errors: errors.filter(e => !e.includes('skipping')), warnings: errors.filter(e => e.includes('skipping')), parsed };
}

function previewYamlSubs() {
  document.getElementById('sub-yaml-error').style.display = 'none';
  document.getElementById('sub-yaml-preview').style.display = 'none';
  const yaml = document.getElementById('sub-yaml-input').value;
  const { errors, warnings = [], parsed } = parseSubYaml(yaml);

  if (errors.length) {
    showSubError('sub-yaml-error', errors.join('\n'));
    return;
  }
  const preview = document.getElementById('sub-yaml-preview');
  let html = `<div style="font-size:11px;color:var(--tx3);margin-bottom:8px;font-family:var(--fm)">Preview — ${parsed.length} subscription${parsed.length !== 1 ? 's' : ''} ready to import${warnings.length ? ` (${warnings.length} skipped — already registered)` : ''}</div>`;
  html += parsed.map(s => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(0,229,160,.05);border:1px solid rgba(0,229,160,.2);border-radius:6px;margin-bottom:6px">
      <div style="width:6px;height:6px;border-radius:50%;background:var(--grn);flex-shrink:0"></div>
      <div style="flex:1"><div style="font-size:12px;font-weight:600;color:var(--tx)">${s.name}</div>
      <div style="font-size:10px;font-family:var(--fm);color:var(--tx3)">${s.subscription_id}</div></div>
      <span style="font-size:10px;font-family:var(--fm);color:${ENV_COLOR[s.environment]||'var(--tx2)'};background:${ENV_BG[s.environment]||'var(--bg3)'};padding:1px 7px;border-radius:3px">${s.environment}</span>
    </div>`).join('');
  if (warnings.length) {
    html += warnings.map(w => `<div style="font-size:11px;color:var(--amb);padding:4px 0">${w}</div>`).join('');
  }
  preview.innerHTML = html;
  preview.style.display = 'block';
}

function importYamlSubs() {
  document.getElementById('sub-yaml-error').style.display = 'none';
  const yaml = document.getElementById('sub-yaml-input').value;
  const { errors, parsed } = parseSubYaml(yaml);
  if (errors.length) { showSubError('sub-yaml-error', errors.join('\n')); return; }
  if (!parsed.length) { showSubError('sub-yaml-error', 'No new subscriptions to import (all may already be registered).'); return; }
  subscriptions.push(...parsed);
  renderSubList();
  document.getElementById('sub-yaml-input').value = '';
  document.getElementById('sub-yaml-preview').style.display = 'none';
  toast(`Imported ${parsed.length} subscription${parsed.length !== 1 ? 's' : ''}`);
}

function loadYamlFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('sub-yaml-input').value = e.target.result;
    toast(`Loaded ${file.name}`);
    document.getElementById('sub-yaml-error').style.display = 'none';
    document.getElementById('sub-yaml-preview').style.display = 'none';
  };
  reader.readAsText(file);
  input.value = '';
}

// Initialise list on load
document.addEventListener('DOMContentLoaded', renderSubList);
// Also render immediately in case DOMContentLoaded already fired
renderSubList();

</script>
</body>
</html>
