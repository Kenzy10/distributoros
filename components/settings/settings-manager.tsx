'use client';

import { useActionState, useState, useTransition } from 'react';
import {
  addTeamMemberAction,
  removeTeamMemberAction,
  updateMemberRoleAction,
  updateOrgProfileAction,
  type SettingsActionState,
} from '@/actions/settings';
import type { Database } from '@/types/database.types';

type OrgRole = Database['public']['Enums']['org_role'];

export type OrgProfileData = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  tax_id: string | null;
  address: string | null;
};

export type TeamMemberItem = {
  id: string;
  user_id: string;
  email: string;
  role: OrgRole;
  created_at: string;
};

const ROLE_META: Record<OrgRole, { label: string; desc: string; badge: string }> = {
  owner: {
    label: 'Owner',
    desc: 'Akses penuh seluruh modul, profil perusahaan, dan tim',
    badge: 'border-purple-300 bg-purple-50 text-purple-800',
  },
  admin: {
    label: 'Admin',
    desc: 'Kelola operasional, master data, keuangan, dan anggota tim',
    badge: 'border-blue-300 bg-blue-50 text-blue-800',
  },
  sales: {
    label: 'Sales',
    desc: 'Buat pesanan (Orders), kelola pelanggan, dan pantau tagihan',
    badge: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  },
  warehouse: {
    label: 'Gudang',
    desc: 'Catat stok masuk/opname dan proses pengiriman pesanan',
    badge: 'border-amber-300 bg-amber-50 text-amber-800',
  },
};

const initialState: SettingsActionState = {};

export function SettingsManager({
  org,
  members,
  currentUserId,
  currentRole,
}: {
  org: OrgProfileData;
  members: TeamMemberItem[];
  currentUserId: string;
  currentRole: OrgRole;
}) {
  const canManage = currentRole === 'owner' || currentRole === 'admin';
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [profileState, profileAction, isSavingProfile] = useActionState(
    updateOrgProfileAction,
    initialState
  );
  const [addState, addAction, isAddingMember] = useActionState(
    addTeamMemberAction,
    initialState
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Pengaturan Perusahaan & Tim
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Identitas perusahaan tampil otomatis pada kop dokumen Invoice & Surat Jalan.
        </p>
      </div>

      {!canManage && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Anda masuk sebagai <strong>{ROLE_META[currentRole].label}</strong>. Perubahan
          profil perusahaan dan anggota tim hanya dapat dilakukan oleh Owner atau Admin.
        </div>
      )}

      {(notice || errorMsg) && (
        <div
          className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${
            errorMsg
              ? 'border-red-300 bg-red-50 text-red-800'
              : 'border-emerald-300 bg-emerald-50 text-emerald-800'
          }`}
        >
          <span>{errorMsg ?? notice}</span>
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setErrorMsg(null);
            }}
            className="text-xs font-bold underline"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Bagian 1: Profil Perusahaan */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
        <div className="mb-4 border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900">
            Profil Perusahaan Distributor
          </h2>
          <p className="text-xs text-slate-600">
            Informasi legalitas, kontak kantor, dan alamat gudang utama.
          </p>
        </div>

        {profileState.error && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {profileState.error}
          </div>
        )}
        {profileState.success && (
          <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
            {profileState.success}
          </div>
        )}

        <form action={profileAction} className="space-y-4 text-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700">
                Nama Usaha / Perusahaan *
              </label>
              <input
                name="name"
                required
                disabled={!canManage}
                defaultValue={org.name}
                placeholder="PT Sumber Makmur Distribusi"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-slate-900 disabled:bg-slate-100"
              />
              {profileState.fieldErrors?.name && (
                <p className="mt-1 text-xs text-red-600">{profileState.fieldErrors.name[0]}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700">
                Slug Workspace *
              </label>
              <input
                name="slug"
                required
                disabled={!canManage}
                defaultValue={org.slug}
                placeholder="sumber-makmur"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2 font-mono text-slate-900 disabled:bg-slate-100"
              />
              {profileState.fieldErrors?.slug && (
                <p className="mt-1 text-xs text-red-600">{profileState.fieldErrors.slug[0]}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700">
                Nomor Telepon / WhatsApp Kantor
              </label>
              <input
                name="phone"
                disabled={!canManage}
                defaultValue={org.phone ?? ''}
                placeholder="021-5551234 / 62812xxxx"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-slate-900 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700">
                NPWP Perusahaan
              </label>
              <input
                name="tax_id"
                disabled={!canManage}
                defaultValue={org.tax_id ?? ''}
                placeholder="01.234.567.8-901.000"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2 font-mono text-slate-900 disabled:bg-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-700">
              Alamat Gudang / Kantor Pusat
            </label>
            <textarea
              name="address"
              rows={2}
              disabled={!canManage}
              defaultValue={org.address ?? ''}
              placeholder="Jl. Raya Industri No. 88, Kawasan Pergudangan..."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-slate-900 disabled:bg-slate-100"
            />
          </div>

          {canManage && (
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {isSavingProfile ? 'Menyimpan...' : 'Simpan Profil Perusahaan'}
              </button>
            </div>
          )}
        </form>
      </section>

      {/* Bagian 2: Manajemen Role Anggota Tim */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
        <div className="mb-4 border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900">
            Manajemen Anggota Tim & Role ({members.length} Orang)
          </h2>
          <p className="text-xs text-slate-600">
            Atur pembagian peran antara Owner, Admin, Sales lapangan, dan staf Gudang.
          </p>
        </div>

        {canManage && (
          <form
            action={addAction}
            className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <p className="mb-2.5 text-xs font-bold uppercase text-slate-700">
              Tambah Anggota Tim (Akun Terdaftar)
            </p>
            {addState.error && (
              <div className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
                {addState.error}
              </div>
            )}
            {addState.success && (
              <div className="mb-3 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                {addState.success}
              </div>
            )}
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <input
                name="email"
                type="email"
                required
                placeholder="email.staf@perusahaan.com"
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900"
              />
              <select
                name="role"
                defaultValue="sales"
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-900"
              >
                <option value="admin">Admin</option>
                <option value="sales">Sales</option>
                <option value="warehouse">Gudang (Warehouse)</option>
                <option value="owner">Owner</option>
              </select>
              <button
                type="submit"
                disabled={isAddingMember}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {isAddingMember ? 'Menambahkan...' : '+ Tambah Anggota'}
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-600">
              <tr>
                <th className="px-4 py-3">Anggota / Email</th>
                <th className="px-4 py-3">Hak Akses (Role)</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m) => {
                const isSelf = m.user_id === currentUserId;
                const meta = ROLE_META[m.role];
                return (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        {m.email}{' '}
                        {isSelf && (
                          <span className="ml-1.5 rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">
                            Anda
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600">{meta.desc}</div>
                    </td>
                    <td className="px-4 py-3">
                      {canManage ? (
                        <select
                          aria-label={`Ubah role ${m.email}`}
                          value={m.role}
                          disabled={isPending}
                          onChange={(e) => {
                            const nextRole = e.target.value as OrgRole;
                            startTransition(async () => {
                              const res = await updateMemberRoleAction(m.id, nextRole);
                              setErrorMsg(res.error ?? null);
                              setNotice(res.success ?? null);
                            });
                          }}
                          className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold ${meta.badge}`}
                        >
                          <option value="owner">Owner</option>
                          <option value="admin">Admin</option>
                          <option value="sales">Sales</option>
                          <option value="warehouse">Gudang</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${meta.badge}`}
                        >
                          {meta.label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canManage && !isSelf ? (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => {
                            if (!confirm(`Keluarkan ${m.email} dari tim?`)) return;
                            startTransition(async () => {
                              const res = await removeTeamMemberAction(m.id);
                              setErrorMsg(res.error ?? null);
                              setNotice(res.success ?? null);
                            });
                          }}
                          className="rounded-lg border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                        >
                          Keluarkan
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default SettingsManager;
