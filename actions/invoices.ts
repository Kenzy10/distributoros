'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgContext } from '@/lib/supabase/get-active-org';
import { formatRupiah } from '@/lib/utils';
import { recordPaymentSchema } from '@/lib/validations/invoice';

export type InvoiceActionState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function recordPaymentAction(
  _prevState: InvoiceActionState,
  formData: FormData
): Promise<InvoiceActionState> {
  const { supabase, user, organizationId } = await getActiveOrgContext();

  const parsed = recordPaymentSchema.safeParse({
    invoice_id: formData.get('invoice_id'),
    amount: formData.get('amount'),
    payment_method: formData.get('payment_method') || 'bank_transfer',
    payment_date: formData.get('payment_date'),
    reference_number: formData.get('reference_number') ?? '',
    notes: formData.get('notes') ?? '',
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const {
    invoice_id,
    amount,
    payment_method,
    payment_date,
    reference_number,
    notes,
  } = parsed.data;

  // 1. Ambil data tagihan dan validasi kepemilikan organisasi
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, invoice_number, total_amount, paid_amount, status')
    .eq('id', invoice_id)
    .eq('organization_id', organizationId)
    .single();

  if (invoiceError || !invoice) {
    return { error: 'Data tagihan tidak ditemukan.' };
  }

  if (invoice.status === 'paid') {
    return { error: `Tagihan ${invoice.invoice_number} sudah berstatus Lunas.` };
  }

  if (invoice.status === 'void') {
    return {
      error: `Tagihan ${invoice.invoice_number} sudah dibatalkan (void) dan tidak dapat menerima pembayaran.`,
    };
  }

  const totalAmount = Number(invoice.total_amount);
  const currentPaid = Number(invoice.paid_amount);
  const remainingAmount = Math.max(0, totalAmount - currentPaid);

  if (amount > remainingAmount) {
    return {
      fieldErrors: {
        amount: [
          `Nominal melebihi sisa tagihan (${formatRupiah(remainingAmount)}).`,
        ],
      },
    };
  }

  // Gabungkan nomor referensi bukti transfer/giro ke notes agar sesuai kolom tabel payments
  const combinedNotes = reference_number
    ? `[Ref: ${reference_number}]${notes ? ` ${notes}` : ''}`
    : notes || null;

  // 2. Simpan pembayaran ke tabel payments (trigger trg_sync_invoice_payment otomatis sinkronisasi status invoice)
  const { error: paymentInsertError } = await supabase.from('payments').insert({
    organization_id: organizationId,
    invoice_id: invoice.id,
    amount,
    payment_method,
    payment_date,
    notes: combinedNotes,
    created_by: user.id,
  });

  if (paymentInsertError) {
    return {
      error: `Gagal mencatat pembayaran: ${paymentInsertError.message}`,
    };
  }

  const isFullyPaid = currentPaid + amount >= totalAmount;

  revalidatePath('/invoices');
  revalidatePath('/customers');
  revalidatePath('/orders');
  revalidatePath('/reports');
  revalidatePath('/');

  return {
    success: isFullyPaid
      ? `Pembayaran ${formatRupiah(amount)} dicatat. Tagihan ${invoice.invoice_number} kini LUNAS.`
      : `Cicilan pembayaran sebesar ${formatRupiah(amount)} untuk ${invoice.invoice_number} berhasil dicatat.`,
  };
}