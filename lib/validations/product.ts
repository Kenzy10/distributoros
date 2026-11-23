import { z } from 'zod';

export const productSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(2, 'SKU minimal 2 karakter')
    .max(50, 'SKU maksimal 50 karakter')
    .transform((val) => val.toUpperCase()),
  name: z
    .string()
    .trim()
    .min(2, 'Nama produk minimal 2 karakter')
    .max(150, 'Nama produk maksimal 150 karakter'),
  category: z
    .string()
    .trim()
    .max(80, 'Kategori maksimal 80 karakter')
    .optional()
    .default(''),
  unit: z
    .string()
    .trim()
    .min(1, 'Satuan wajib diisi (misal: pcs, dus, karton)')
    .max(30, 'Satuan maksimal 30 karakter'),
  cost_price: z.coerce
    .number({ error: 'Harga modal harus berupa angka' })
    .min(0, 'Harga modal tidak boleh negatif'),
  wholesale_price: z.coerce
    .number({ error: 'Harga grosir harus berupa angka' })
    .min(0, 'Harga grosir tidak boleh negatif'),
  selling_price: z.coerce
    .number({ error: 'Harga normal/ecer harus berupa angka' })
    .min(0, 'Harga jual tidak boleh negatif'),
  min_stock_alert: z.coerce
    .number({ error: 'Batas stok minimum harus berupa angka' })
    .int('Batas stok minimum harus bilangan bulat')
    .min(0, 'Batas stok minimum tidak boleh negatif')
    .default(5),
  initial_stock: z.coerce
    .number({ error: 'Stok awal harus berupa angka' })
    .int('Stok awal harus bilangan bulat')
    .min(0, 'Stok awal tidak boleh negatif')
    .optional()
    .default(0),
});

export const updateProductSchema = productSchema.omit({ initial_stock: true }).extend({
  id: z.string().uuid('ID produk tidak valid'),
  is_active: z.boolean().default(true),
});