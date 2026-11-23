'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACTIVE_ORG_COOKIE } from '@/lib/supabase/get-active-org';
import { createClient } from '@/lib/supabase/server';
import { loginSchema, registerSchema } from '@/lib/validations/auth';

export type AuthActionState = {
  error?: string;
  successMessage?: string;
  fieldErrors?: Record<string, string[]>;
};

function sanitizeRedirectPath(rawNext: FormDataEntryValue | null): string {
  if (typeof rawNext !== 'string') return '/';
  // Cegah open-redirect ke domain eksternal
  if (!rawNext.startsWith('/') || rawNext.startsWith('//')) return '/';
  return rawNext;
}

export async function signInAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      return { error: 'Email atau password salah. Silakan periksa kembali.' };
    }
    if (error.message.includes('Email not confirmed')) {
      return {
        error: 'Email Anda belum diverifikasi. Silakan cek kotak masuk email Anda.',
      };
    }
    return { error: `Gagal masuk: ${error.message}` };
  }

  const nextPath = sanitizeRedirectPath(formData.get('next'));
  revalidatePath('/', 'layout');
  redirect(nextPath);
}

export async function signUpAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
      },
    },
  });

  if (error) {
    if (error.message.includes('User already registered')) {
      return {
        fieldErrors: {
          email: ['Email ini sudah terdaftar. Silakan langsung masuk.'],
        },
      };
    }
    return { error: `Gagal mendaftar: ${error.message}` };
  }

  // Jika fitur "Confirm email" di Supabase Auth aktif, session bernilai null
  if (!data.session) {
    return {
      successMessage:
        'Pendaftaran berhasil! Silakan klik tautan verifikasi yang dikirim ke email Anda sebelum login.',
    };
  }

  // Jika "Confirm email" nonaktif, langsung arahkan ke pembuatan perusahaan pertama
  revalidatePath('/', 'layout');
  redirect('/onboarding');
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_ORG_COOKIE);

  redirect('/login');
}

export async function switchOrganizationAction(organizationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (!membership) {
    throw new Error('Akses ke perusahaan ditolak.');
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidatePath('/', 'layout');
}