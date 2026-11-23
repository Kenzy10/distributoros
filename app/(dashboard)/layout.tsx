import { Sidebar, type OrgMembershipItem } from '@/components/layout/sidebar';
import { getActiveOrgContext } from '@/lib/supabase/get-active-org';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, organizationId, role, organization, allMemberships } =
    await getActiveOrgContext();

  const activeOrg = Array.isArray(organization) ? organization[0] : organization;

  const formattedMemberships: OrgMembershipItem[] = allMemberships.map((m) => ({
    organization_id: m.organization_id,
    role: m.role,
    organizations: Array.isArray(m.organizations)
      ? (m.organizations[0] ?? null)
      : m.organizations,
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        activeOrgId={organizationId}
        activeOrgName={activeOrg?.name ?? 'Workspace Distribusi'}
        activeRole={role}
        userEmail={user.email ?? ''}
        memberships={formattedMemberships}
      />

      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}