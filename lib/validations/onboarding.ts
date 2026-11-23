import { z } from 'zod';

function normalizeIndoPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

export const onboardingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Nama perusahaan minimal 3 karakter')
    .max(100, 'Nama perusahaan maksimal 100 karakter'),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Kode/URL perusahaan minimal 3 karakter')
    .max(50, 'Kode/URL perusahaan maksimal 50 karakter')
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Gunakan huruf kecil, angka, dan tanda hubung (-) saja'
    ),
  phone: z
    .string()
    .trim()
    .transform(normalizeIndoPhone)
    .refine(
      (val) => val === '' || /^628[0-9]{8,12}$/.test(val),
      'Nomor WhatsApp tidak valid (contoh: 081234567890)'
    ),
  address: z
    .string()
    .trim()
    .max(255, 'Alamat maksimal 255 karakter')
    .optional()
    .default(''),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;