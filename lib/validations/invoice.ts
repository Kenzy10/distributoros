import { z } from 'zod';

export const PAYMENT_METHODS = [
  'bank_transfer',
  'cash',
  'giro',
  'qris',
  'other',
] as const;

export const recordPaymentSchema = z.object({
  invoice_id: z.string().uuid('ID tagihan tidak valid'),
  amount: z.coerce
    .number({ error: 'Nominal pembayaran harus berupa angka' })
    .positive('Nominal pembayaran harus lebih dari Rp 0'),
  payment_method: z.enum(PAYMENT_METHODS, {
    error: 'Pilih metode pembayaran yang valid',
  }),
  payment_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal pembayaran tidak valid'),
  reference_number: z
    .string()
    .trim()
    .max(100, 'Nomor referensi maksimal 100 karakter')
    .optional()
    .default(''),
  notes: z
    .string()
    .trim()
    .max(300, 'Catatan maksimal 300 karakter')
    .optional()
    .default(''),
});