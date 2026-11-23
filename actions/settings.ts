'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgContext } from '@/lib/supabase/get-active-org';
import { addMemberSchema, orgProfileSchema, ORG_ROLES } from '@/lib/validations/settings';
import type { Database } from '@/types/database.types';

type OrgRole = Database['public']['Enums']['org_role'];

export type SettingsActionState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function updateOrgProfileAction(
  _prev: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const { supabase, organizationId, role } = await getActiveOrgContext();
  if (role !== 'owner' && role !== 'admin') {
    return { error: 'Hanya Owner atau Admin yang dapat mengubah profil perusahaan.' };
  }

  const parsed = orgProfileSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    phone: formData.get('phone') ?? '',
    tax_id: formData.get('tax_id') ?? '',
    address: formData.get('address') ?? '',
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { name, slug, phone, tax_id, address } = parsed.data;
  const { error } = await supabase
    .from('organizations')
    .update({
      name,
      slug,
      phone: phone || null,
      tax_id: tax_id || null,
      address: address || null,
    })
    .eq('id', organizationId);

  if (error) {
    if (error.code === '23505') {
      return { fieldErrors: { slug: ['Slug ini sudah dipakai perusahaan lain.'] } };
    }
    return { error: `Gagal memperbarui profil: ${error.message}` };
  }

  revalidatePath('/settings');
  revalidatePath('/', 'layout');
  return { success: 'Profil perusahaan berhasil diperbarui.' };
}

export async function addTeamMemberAction(
  _prev: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const { supabase, organizationId, role } = await getActiveOrgContext();
  if (role !== 'owner' && role !== 'admin') {
    return { error: 'Hanya Owner atau Admin yang dapat menambah anggota.' };
  }

  const parsed = addMemberSchema.safeParse({
    email: formData.get('email'),
    role: formData.get('role'),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('add_org_member_by_email', {
    p_org_id: organizationId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });

  if (error) {
    if (error.code === '23505') {
      return { error: 'Pengguna tersebut sudah terdaftar di tim perusahaan ini.' };
    }
    return { error: error.message };
  }

  revalidatePath('/settings');
  return { success: `Anggota ${parsed.data.email} berhasil ditambahkan.` };
}

export async function updateMemberRoleAction(memberId: string, nextRole: OrgRole) {
  const { supabase, organizationId, role } = await getActiveOrgContext();
  if (role !== 'owner' && role !== 'admin') {
    return { error: 'Akses ditolak.' };
  }
  if (!ORG_ROLES.includes(nextRole)) {
    return { error: 'Role tidak valid.' };
  }

  const { data: members } = await supabase
    .from('organization_members')
    .select('id, role')
    .eq('organization_id', organizationId);

  const target = (members ?? []).find((m) => m.id === memberId);
  const ownerCount = (members ?? []).filter((m) => m.role === 'owner').length;
  if (target?.role === 'owner' && nextRole !== 'owner' && ownerCount <= 1) {
    return { error: 'Minimal harus ada 1 Owner aktif di perusahaan.' };
  }

  const { error } = await supabase
    .from('organization_members')
    .update({ role: nextRole })
    .eq('id', memberId)
    .eq('organization_id', organizationId);

  if (error) return { error: error.message };
  revalidatePath('/settings');
  revalidatePath('/', 'layout');
  return { success: 'Role anggota tim berhasil diperbarui.' };
}

export async function removeTeamMemberAction(memberId: string) {
  const { supabase, user, organizationId, role } = await getActiveOrgContext();
  if (role !== 'owner' && role !== 'admin') {
    return { error: 'Akses ditolak.' };
  }

  const { data: target } = await supabase
    .from('organization_members')
    .select('id, user_id, role')
    .eq('id', memberId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (!target) return { error: 'Anggota tidak ditemukan.' };
  if (target.user_id === user.id) {
    return { error: 'Anda tidak dapat menghapus akun Anda sendiri dari perusahaan.' };
  }
  if (target.role === 'owner') {
    return { error: 'Ubah role Owner terlebih dahulu sebelum menghapus anggota.' };
  }

  const { error } = await supabase
    .from('organization_members')
    .delete()
    .eq('id', memberId)
    .eq('organization_id', organizationId);

  if (error) return { error: error.message };
  revalidatePath('/settings');
  return { success: 'Anggota berhasil dikeluarkan dari tim.' };
}
