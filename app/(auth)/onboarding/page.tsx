'use client';

import { useActionState, useState } from 'react';
import {
  createFirstOrganizationAction,
  type OnboardingActionState,
} from '@/actions/onboarding';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

const initialState: OnboardingActionState = {};

export default function OnboardingPage() {
  const [state, formAction, isPending] = useActionState(
    createFirstOrganizationAction,
    initialState
  );
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugEdited) {
      setSlug(slugify(value));
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
            DistribusiOS Setup
          </span>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Daftarkan Perusahaan Anda
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Satu sistem untuk mengelola seluruh operasional distribusi, stok,
            dan piutang pelanggan.
          </p>
        </div>

        {state.error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Nama Perusahaan / Gudang *
            </label>
            <input
              type="text"
              name="name"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Contoh: PT Sumber Makmur Distribusi"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            {state.fieldErrors?.name && (
              <p className="mt-1 text-xs text-red-600">
                {state.fieldErrors.name[0]}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              ID Workspace (Slug) *
            </label>
            <input
              type="text"
              name="slug"
              required
              value={slug}
              onChange={(e) => {
                setSlugEdited(true);
                setSlug(slugify(e.target.value));
              }}
              placeholder="sumber-makmur-distribusi"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
            />
            {state.fieldErrors?.slug && (
              <p className="mt-1 text-xs text-red-600">
                {state.fieldErrors.slug[0]}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Nomor WhatsApp Operasional
            </label>
            <input
              type="tel"
              name="phone"
              placeholder="081234567890"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-600">
              Otomatis diformat ke 628xxx untuk integrasi WhatsApp API.
            </p>
            {state.fieldErrors?.phone && (
              <p className="mt-1 text-xs text-red-600">
                {state.fieldErrors.phone[0]}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Alamat Kantor / Gudang Utama
            </label>
            <textarea
              name="address"
              rows={2}
              placeholder="Jl. Raya Industri No. 12, Jakarta"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? 'Menyiapkan Workspace...' : 'Mulai Gunakan DistribusiOS'}
          </button>
        </form>
      </div>
    </div>
  );
}