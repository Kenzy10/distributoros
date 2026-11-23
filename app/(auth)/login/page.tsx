'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useActionState } from 'react';
import { signInAction, type AuthActionState } from '@/actions/auth';

const initialState: AuthActionState = {};

function LoginForm() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') ?? '/';
  const [state, formAction, isPending] = useActionState(
    signInAction,
    initialState
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={nextPath} />

      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-slate-700"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="admin@perusahaan.co.id"
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
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
        />
        {state.fieldErrors?.password && (
          <p className="mt-1 text-xs text-red-600">
            {state.fieldErrors.password[0]}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? 'Memverifikasi...' : 'Masuk ke DistribusiOS'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
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
            Masuk ke Akun Anda
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Satu sistem untuk mengelola seluruh operasional distribusi.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="py-6 text-center text-sm text-slate-600">
              Memuat formulir...
            </div>
          }
        >
          <LoginForm />
        </Suspense>

        <p className="mt-6 text-center text-sm text-slate-600">
          Belum punya akun perusahaan?{' '}
          <Link
            href="/register"
            className="font-semibold text-blue-600 hover:text-blue-700"
          >
            Daftar sekarang
          </Link>
        </p>
      </div>
    </div>
  );
}