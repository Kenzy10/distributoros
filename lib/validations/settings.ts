import { z } from 'zod';

export const ORG_ROLES = ['owner', 'admin', 'sales', 'warehouse'] as const;

export const orgProfileSchema = z.object({
  name: z.string().trim().min(3, 'Nama usaha minimal 3 karakter').max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Slug minimal 3 karakter')
    .max(50)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Gunakan huruf kecil, angka, dan tanda hubung (-)'),
  phone: z.string().trim().max(30).optional().default(''),
  tax_id: z.string().trim().max(40).optional().default(''),
  address: z.string().trim().max(300).optional().default(''),
});

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email('Format email tidak valid'),
  role: z.enum(ORG_ROLES, { error: 'Pilih role anggota yang valid' }),
});
