'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useTransition } from 'react';
import { signOutAction, switchOrganizationAction } from '@/actions/auth';
import type { Database } from '@/types/database.types';

type OrgRole = Database['public']['Enums']['org_role'];

export type OrgMembershipItem = {
  organization_id: string;
  role: OrgRole;
  organizations: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

type SidebarProps = {
  activeOrgId: string;
  activeOrgName: string;
  activeRole: OrgRole;
  userEmail: string;
  memberships: OrgMembershipItem[];
};

const NAV_ITEMS = [
  {
    name: 'Dashboard',
    href: '/',
    description: 'Ringkasan bisnis',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
      </svg>
    ),
  },
  {
    name: 'Products',
    href: '/products',
    description: 'Katalog & harga',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    name: 'Inventory',
    href: '/inventory',
    description: 'Stok masuk & keluar',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  {
    name: 'Orders',
    href: '/orders',
    description: 'Pesanan pelanggan',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    name: 'Customers',
    href: '/customers',
    description: 'Database pelanggan',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    name: 'Invoices',
    href: '/invoices',
    description: 'Invoice & pembayaran',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
      </svg>
    ),
  },
  {
    name: 'Settings',
    href: '/settings',
    description: 'Perusahaan & tim',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    name: 'Reports',
    href: '/reports',
    description: 'Laporan penjualan',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

const ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  sales: 'Sales',
  warehouse: 'Gudang',
};

export function Sidebar({
  activeOrgId,
  activeOrgName,
  activeRole,
  userEmail,
  memberships,
}: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function isActiveRoute(href: string) {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function handleOrgChange(newOrgId: string) {
    if (newOrgId === activeOrgId) return;
    startTransition(async () => {
      await switchOrganizationAction(newOrgId);
      setMobileOpen(false);
    });
  }

  const sidebarContent = (
    <div className="flex h-full flex-col border-r border-slate-200 bg-white">
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 font-bold text-white">
            D
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-slate-900">
              Distribusi<span className="text-blue-600">OS</span>
            </span>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-600 lg:hidden"
          aria-label="Tutup menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tenant / Organization Switcher */}
      <div className="border-b border-slate-100 p-4">
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-600">
          Perusahaan Aktif
        </label>
        {memberships.length > 1 ? (
          <select
            value={activeOrgId}
            disabled={isPending}
            onChange={(e) => handleOrgChange(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none disabled:opacity-50"
          >
            {memberships.map((m) => (
              <option key={m.organization_id} value={m.organization_id}>
                {m.organizations?.name ?? 'Perusahaan'}
              </option>
            ))}
          </select>
        ) : (
          <div className="rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2">
            <p className="truncate text-sm font-semibold text-slate-800">{activeOrgName}</p>
            <span className="mt-0.5 inline-block rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">
              {ROLE_LABELS[activeRole]}
            </span>
          </div>
        )}
      </div>

      {/* 7 Modules Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active = isActiveRoute(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span
                className={`transition ${
                  active ? 'text-blue-600' : 'text-slate-600 group-hover:text-slate-600'
                }`}
              >
                {item.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate">{item.name}</div>
                <div
                  className={`truncate text-[11px] font-normal ${
                    active ? 'text-blue-600/80' : 'text-slate-600'
                  }`}
                >
                  {item.description}
                </div>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User Footer & Logout */}
      <div className="border-t border-slate-100 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-slate-700">{userEmail}</p>
            <p className="text-[11px] text-slate-600">Role: {ROLE_LABELS[activeRole]}</p>
          </div>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Keluar Akun
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-sm font-bold text-white">
            D
          </div>
          <span className="text-sm font-bold text-slate-900">DistribusiOS</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
          aria-label="Buka menu navigasi"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-50 w-72 max-w-[80vw]">{sidebarContent}</div>
        </div>
      )}

      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:z-30 lg:flex lg:w-64 lg:flex-col">
        {sidebarContent}
      </aside>
    </>
  );
}