'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ACTIVE_ORG_COOKIE } from '@/lib/supabase/get-active-org';
import { onboardingSchema } from '@/lib/validations/onboarding';

export type OnboardingActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function createFirstOrganizationAction(
  _prevState: OnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Sesi Anda telah berakhir. Silakan login kembali.' };
  }

  const parsed = onboardingSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    phone: formData.get('phone') ?? '',
    address: formData.get('address') ?? '',
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { name, slug, phone, address } = parsed.data;

  // Panggil RPC atomic: insert organizations + assign user sebagai owner
  const { data: orgId, error } = await supabase.rpc(
    'create_organization_with_owner',
    {
      p_name: name,
      p_slug: slug,
      p_phone: phone || undefined,
      p_address: address || undefined,
    }
  );

  if (error) {
    // Kode 23505 = PostgreSQL unique_violation (slug sudah terpakai)
    if (error.code === '23505') {
      return {
        fieldErrors: {
          slug: ['Slug perusahaan ini sudah digunakan. Silakan pilih nama lain.'],
        },
      };
    }

    return {
      error: `Gagal membuat profil perusahaan: ${error.message}`,
    };
  }

  if (orgId) {
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_ORG_COOKIE, orgId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 hari
    });
  }

  redirect('/');
}