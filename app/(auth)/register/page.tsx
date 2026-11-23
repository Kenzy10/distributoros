'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { signUpAction, type AuthActionState } from '@/actions/auth';

const initialState: AuthActionState = {};

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(
    signUpAction,
    initialState
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-xs">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 font-bold text-white">
              D
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900">
              Distribusi<span className="text-blue-600">OS</span>
            </span>
          </div>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">
            Buat Akun Baru
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Mulai kelola katalog produk, stok gudang, pesanan, dan piutang
            pelanggan.
          </p>
        </div>

        {state.error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {state.error}
          </div>
        )}

        {state.successMessage ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              {state.successMessage}
            </div>
            <Link
              href="/login"
              className="block w-full rounded-lg bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Lanjut ke Halaman Login
            </Link>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            <div>
              <label
                htmlFor="fullName"
                className="block text-sm font-medium text-slate-700"
              >
                Nama Lengkap *
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                autoComplete="name"
                required
                placeholder="Budi Santoso"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              />
              {state.fieldErrors?.fullName && (
                <p className="mt-1 text-xs text-red-600">
                  {state.fieldErrors.fullName[0]}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700"
              >
                Email Kerja *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="budi@distribusi-makmur.co.id"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              />
              {state.fieldErrors?.email && (
                <p className="mt-1 text-xs text-red-600">
                  {state.fieldErrors.email[0]}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700"
              >
                Password *
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                placeholder="Minimal 6 karakter"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              />
              {state.fieldErrors?.password && (
                <p className="mt-1 text-xs text-red-600">
                  {state.fieldErrors.password[0]}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-slate-700"
              >
                Konfirmasi Password *
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                placeholder="Ulangi password"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              />
              {state.fieldErrors?.confirmPassword && (
                <p className="mt-1 text-xs text-red-600">
                  {state.fieldErrors.confirmPassword[0]}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? 'Mendaftarkan Akun...' : 'Daftar & Lanjut Setup'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-600">
          Sudah punya akun?{' '}
          <Link
            href="/login"
            className="font-semibold text-blue-600 hover:text-blue-700"
          >
            Masuk di sini
          </Link>
        </p>
      </div>
    </div>
  );
}