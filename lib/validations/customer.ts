import { z } from 'zod';

export const CUSTOMER_TIERS = ['retail', 'wholesale', 'agent'] as const;

export const PAYMENT_TERMS = [
  'COD',
  'NET_7',
  'NET_14',
  'NET_30',
  'NET_60',
] as const;

export const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nama PIC / kontak minimal 2 karakter')
    .max(120, 'Nama maksimal 120 karakter'),
  business_name: z
    .string()
    .trim()
    .max(150, 'Nama toko/perusahaan maksimal 150 karakter')
    .optional()
    .default(''),
  phone: z
    .string()
    .trim()
    .max(30, 'Nomor telepon maksimal 30 karakter')
    .optional()
    .default(''),
  email: z
    .string()
    .trim()
    .email('Format email tidak valid')
    .or(z.literal(''))
    .optional()
    .default(''),
  address: z
    .string()
    .trim()
    .max(500, 'Alamat maksimal 500 karakter')
    .optional()
    .default(''),
  tier: z.enum(CUSTOMER_TIERS, {
    error: 'Pilih tier harga pelanggan yang valid',
  }),
  payment_terms: z.enum(PAYMENT_TERMS, {
    error: 'Pilih termin pembayaran yang valid',
  }),
  credit_limit: z
    .number({ error: 'Plafon kredit harus berupa angka' })
    .min(0, 'Plafon kredit tidak boleh negatif')
    .default(0),
});
