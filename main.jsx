import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useStream } from '../hooks/useStream'
import { useState } from 'react'
import {
  LayoutDashboard, ShieldCheck, Play, Server,
  BarChart3, Zap, Settings, Activity, CloudLightning
} from 'lucide-react'

const nav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/analytics',  icon: BarChart3,       label: 'Analytics' },
  { to: '/resources',  icon: Server,           label: 'Waste Resources' },
  { to: '/policies',   icon: ShieldCheck,      label: 'Policies' },
  { to: '/runs',       icon: Play,             label: 'Policy Runs' },
  { to: '/actions',    icon: Zap,              label: 'Remediation' },
  { to: '/settings',   icon: Settings,         label: 'Settings' },
]

export default function Layout() {
  const connected = useStream()   // open SSE connection — live updates from Postgres
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, flexShrink: 0,
        background: 'var(--bg-1)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CloudLightning size={18} color="#000" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--text)', lineHeight: 1.2 }}>
                Custodian
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                Azure Cost Intelligence
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to} to={to}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 6,
                textDecoration: 'none',
                fontSize: 13, fontWeight: 500,
                color: isActive ? 'var(--accent)' : 'var(--text-2)',
                background: isActive ? 'rgba(0,212,255,0.08)' : 'transparent',
                transition: 'all 0.15s',
              })}
            >
              {({ isActive }) => (
                <>
                  <Icon size={15} strokeWidth={isActive ? 2.5 : 2} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom status */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: connected ? 'var(--green)' : 'var(--red)' }} />
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)',
              color: connected ? 'var(--green)' : 'var(--red)' }}>
              {connected ? 'Live' : 'Reconnecting…'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={12} color="var(--text-3)" />
            <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              KEDA autoscaling active
            </span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg)' }}>
        <Outlet />
      </main>
    </div>
  )
}
