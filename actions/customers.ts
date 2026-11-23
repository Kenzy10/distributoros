'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgContext } from '@/lib/supabase/get-active-org';
import { customerSchema } from '@/lib/validations/customer';

export type CustomerActionState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
};

function normalizeIndoPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

export async function createCustomerAction(
  _prevState: CustomerActionState,
  formData: FormData
): Promise<CustomerActionState> {
  const { supabase, organizationId } = await getActiveOrgContext();

  const parsed = customerSchema.safeParse({
    name: formData.get('name'),
    business_name: formData.get('business_name') ?? '',
    phone: formData.get('phone') ?? '',
    email: formData.get('email') ?? '',
    address: formData.get('address') ?? '',
    tier: formData.get('tier') || 'retail',
    payment_terms: formData.get('payment_terms') || 'COD',
    credit_limit: Number(formData.get('credit_limit') || 0),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;
  const { error } = await supabase.from('customers').insert({
    organization_id: organizationId,
    name: data.name,
    business_name: data.business_name || null,
    phone: normalizeIndoPhone(data.phone),
    email: data.email || null,
    address: data.address || null,
    tier: data.tier,
    payment_terms: data.payment_terms,
    credit_limit: data.credit_limit,
    is_active: true,
  });

  if (error) {
    return { error: `Gagal menambahkan pelanggan: ${error.message}` };
  }

  revalidatePath('/customers');
  revalidatePath('/orders');
  revalidatePath('/');

  return {
    success: `Pelanggan "${data.business_name || data.name}" berhasil ditambahkan.`,
  };
}

export async function updateCustomerAction(
  _prevState: CustomerActionState,
  formData: FormData
): Promise<CustomerActionState> {
  const { supabase, organizationId } = await getActiveOrgContext();

  const customerId = String(formData.get('customer_id') ?? '');
  if (!customerId) {
    return { error: 'ID pelanggan tidak ditemukan.' };
  }

  const parsed = customerSchema.safeParse({
    name: formData.get('name'),
    business_name: formData.get('business_name') ?? '',
    phone: formData.get('phone') ?? '',
    email: formData.get('email') ?? '',
    address: formData.get('address') ?? '',
    tier: formData.get('tier') || 'retail',
    payment_terms: formData.get('payment_terms') || 'COD',
    credit_limit: Number(formData.get('credit_limit') || 0),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;
  const { error } = await supabase
    .from('customers')
    .update({
      name: data.name,
      business_name: data.business_name || null,
      phone: normalizeIndoPhone(data.phone),
      email: data.email || null,
      address: data.address || null,
      tier: data.tier,
      payment_terms: data.payment_terms,
      credit_limit: data.credit_limit,
    })
    .eq('id', customerId)
    .eq('organization_id', organizationId);

  if (error) {
    return { error: `Gagal memperbarui pelanggan: ${error.message}` };
  }

  revalidatePath('/customers');
  revalidatePath('/orders');
  revalidatePath('/');

  return {
    success: `Data pelanggan "${data.business_name || data.name}" berhasil diperbarui.`,
  };
}

export async function toggleCustomerStatusAction(
  customerId: string,
  nextStatus: boolean
): Promise<CustomerActionState> {
  const { supabase, organizationId } = await getActiveOrgContext();

  const { error } = await supabase
    .from('customers')
    .update({ is_active: nextStatus })
    .eq('id', customerId)
    .eq('organization_id', organizationId);

  if (error) {
    return { error: `Gagal mengubah status pelanggan: ${error.message}` };
  }

  revalidatePath('/customers');
  revalidatePath('/orders');
  revalidatePath('/');

  return {
    success: nextStatus
      ? 'Pelanggan kembali diaktifkan.'
      : 'Pelanggan dinonaktifkan.',
  };
}

export const toggleCustomerActiveAction = toggleCustomerStatusAction;

export async function deleteCustomerAction(id: string) {
  const { supabase, organizationId } = await getActiveOrgContext();
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)
    .eq('organization_id', organizationId);
  if (error) {
    return {
      error: error.code === '23503'
        ? 'Pelanggan sudah punya transaksi. Gunakan tombol Nonaktif.'
        : error.message,
    };
  }
  revalidatePath('/customers');
  return { success: 'Pelanggan berhasil dihapus.' };
}
