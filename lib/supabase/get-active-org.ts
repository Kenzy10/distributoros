import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const ACTIVE_ORG_COOKIE = 'distribusios_active_org';

export async function getActiveOrgContext() {

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: memberships, error } = await supabase
    .from('organization_members')
    .select('organization_id, role, organizations(id, name, slug)')
    .eq('user_id', user.id);

  if (error || !memberships || memberships.length === 0) {
    redirect('/onboarding');
  }

  const cookieStore = await cookies();
  const preferredOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;

  const activeMembership =
    memberships.find((m) => m.organization_id === preferredOrgId) ??
    memberships[0];

  const organizations = memberships
    .map((m) => {
      const item = Array.isArray(m.organizations)
        ? m.organizations[0]
        : m.organizations;
      return item ? { ...item, role: m.role } : null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return {
    supabase,
    user,
    organizationId: activeMembership.organization_id,
    role: activeMembership.role,
    organization: activeMembership.organizations ?? null,
    allMemberships: memberships,
    organizations,
  };
}
