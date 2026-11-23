import {
  SettingsManager,
  type TeamMemberItem,
} from '@/components/settings/settings-manager';
import { getActiveOrgContext } from '@/lib/supabase/get-active-org';

export default async function SettingsPage() {
  const { supabase, user, organizationId, role } = await getActiveOrgContext();

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, slug, phone, tax_id, address')
    .eq('id', organizationId)
    .single();

  if (orgError || !org) {
    throw new Error(`Gagal memuat profil perusahaan: ${orgError?.message}`);
  }

  // Ambil daftar anggota beserta email via RPC (fallback ke tabel standar jika RPC belum dibuat)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rpcRes = await (supabase as any).rpc('get_org_members_with_email', {
    p_org_id: organizationId,
  });

  let members: TeamMemberItem[] = [];

  if (!rpcRes.error && Array.isArray(rpcRes.data)) {
    members = rpcRes.data;
  } else {
    const { data: rawMembers } = await supabase
      .from('organization_members')
      .select('id, user_id, role, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true });

    members = (rawMembers ?? []).map((m) => ({
      id: m.id,
      user_id: m.user_id,
      email: m.user_id === user.id ? (user.email ?? m.user_id) : `User (${m.user_id.slice(0, 8)}...)`,
      role: m.role,
      created_at: m.created_at,
    }));
  }

  return (
    <SettingsManager
      org={org}
      members={members}
      currentUserId={user.id}
      currentRole={role}
    />
  );
}
