import { useQuery } from 'react-query'
import {
  fetchByCategory, fetchBySubscription, fetchBySeverity,
  fetchLadderBreakdown, fetchRunHistory, fetchSummary
} from '../../lib/api'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, LineChart, Line, CartesianGrid
} from 'recharts'

const COLORS = ['#ff4e6a', '#ffb547', '#9b7cff', '#00d4ff', '#00e5a0', '#ff8c69', '#c084fc']

const fmt = n => n >= 1000 ? `£${(n/1000).toFixed(1)}k` : `£${Math.round(n)}`

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card" style={{ padding: '10px 14px', fontSize: 12, minWidth: 140 }}>
      <div style={{ color: 'var(--text-2)', marginBottom: 6, fontFamily: 'var(--font-mono)', fontSize: 11 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color || 'var(--text)', display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ color: 'var(--text-2)' }}>{p.name}</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            {p.dataKey === 'total_cost' || p.dataKey === 'waste' ? fmt(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function ChartCard({ title, subtitle, children, span = 1 }) {
  return (
    <div className="card" style={{ padding: 20, gridColumn: `span ${span}` }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}

function MetricCard({ label, value, sub, color }) {
  return (
    <div className="card" style={{ padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color, lineHeight: 1, marginBottom: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{sub}</div>}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: color, opacity: 0.3 }} />
    </div>
  )
}

export default function AnalyticsPage() {
  const { data: summary }       = useQuery('summary',         fetchSummary)
  const { data: byCategory=[] } = useQuery('byCategory',      fetchByCategory)
  const { data: bySub=[] }      = useQuery('bySubscription',  fetchBySubscription)
  const { data: bySev=[] }      = useQuery('bySeverity',      fetchBySeverity)
  const { data: ladder=[] }     = useQuery('ladder',          fetchLadderBreakdown)
  const { data: history30=[] }  = useQuery('history30',       () => fetchRunHistory(30))

  const efficiency = summary
    ? Math.round((summary.total_realised_savings_monthly / (summary.total_identified_waste_monthly || 1)) * 100)
    : 0

  const LADDER_COLORS_MAP = {
    notify: '#8896b0', tagged: '#ffb547', deallocated: '#9b7cff',
    deleted: '#ff4e6a', exempt: '#00e5a0', resized: '#00d4ff', tiered_down: '#00d4ff',
  }

  return (
    <div style={{ padding: '28px 32px' }} className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Analytics</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 13 }}>Cost waste breakdown and remediation performance</p>
      </div>

      {/* Top metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <MetricCard label="Total identified waste" value={fmt(summary?.total_identified_waste_monthly||0)} sub="per month" color="var(--red)" />
        <MetricCard label="Realised savings" value={fmt(summary?.total_realised_savings_monthly||0)} sub="per month" color="var(--green)" />
        <MetricCard label="Execution efficiency" value={`${efficiency}%`} sub="savings vs identified" color={efficiency > 50 ? 'var(--green)' : efficiency > 25 ? 'var(--amber)' : 'var(--red)'} />
        <MetricCard label="Resources tracked" value={(summary?.total_waste_resources||0).toLocaleString()} sub="pending or actioned" color="var(--accent)" />
      </div>

      {/* Chart grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* 30-day waste trend */}
        <ChartCard title="30-day waste trend" subtitle="Identified waste per completed scan day (GBP/month)">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={history30} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#ff4e6a" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ff4e6a" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-3)', fontFamily: 'var(--font-mono)' }} tickFormatter={d => d?.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)', fontFamily: 'var(--font-mono)' }} tickFormatter={v => `£${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="waste" name="waste" stroke="var(--red)" strokeWidth={2} fill="url(#g1)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Ladder breakdown pie */}
        <ChartCard title="Remediation ladder" subtitle="Resources by ladder step">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={ladder} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                {ladder.map(entry => (
                  <Cell key={entry.status} fill={LADDER_COLORS_MAP[entry.status] || '#888'} />
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} />
              <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-mono)' }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Waste by category */}
        <ChartCard title="Waste by category" subtitle="GBP/month">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byCategory} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="category" tick={{ fontSize: 10, fill: 'var(--text-3)', fontFamily: 'var(--font-mono)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)', fontFamily: 'var(--font-mono)' }} tickFormatter={v => `£${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="total_cost" name="waste" radius={[4, 4, 0, 0]}>
                {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Waste by severity */}
        <ChartCard title="Waste by severity" subtitle="Resource count">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={bySev} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="severity" tick={{ fontSize: 10, fill: 'var(--text-3)', fontFamily: 'var(--font-mono)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)', fontFamily: 'var(--font-mono)' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="resources" radius={[4, 4, 0, 0]}>
                {bySev.map(e => (
                  <Cell key={e.severity} fill={
                    e.severity === 'critical' ? '#ff4e6a' :
                    e.severity === 'high'     ? '#ffb547' :
                    e.severity === 'medium'   ? '#9b7cff' : '#00d4ff'
                  } />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Runs per day */}
        <ChartCard title="Scan runs / day" subtitle="Completed policy runs">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={history30} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-3)', fontFamily: 'var(--font-mono)' }} tickFormatter={d => d?.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)', fontFamily: 'var(--font-mono)' }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="runs" name="runs" stroke="var(--accent)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="resources" name="resources" stroke="var(--amber)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Waste by subscription table */}
      <ChartCard title="Waste by subscription" subtitle="Top subscriptions by identified monthly waste">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Subscription ID', 'Resources', 'Monthly waste', 'Share'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bySub.map((s, i) => {
              const total = bySub.reduce((acc, r) => acc + r.total_cost, 0)
              const share = total > 0 ? Math.round((s.total_cost / total) * 100) : 0
              return (
                <tr key={s.subscription_id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)' }}>{s.subscription_id}</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 13 }}>{s.count}</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--red)', fontWeight: 600 }}>{fmt(s.total_cost)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${share}%`, height: '100%', background: COLORS[i % COLORS.length], borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-2)', minWidth: 32, textAlign: 'right' }}>{share}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!bySub.length && (
              <tr><td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-3)' }}>No data yet.</td></tr>
            )}
          </tbody>
        </table>
      </ChartCard>
    </div>
  )
}
