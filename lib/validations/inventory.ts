import { z } from 'zod';

export const inventoryMovementSchema = z
  .object({
    product_id: z.string().uuid('Pilih produk terlebih dahulu'),
    type: z.enum(['in', 'adjustment'], {
      error: 'Tipe mutasi harus Stok Masuk atau Penyesuaian',
    }),
    qty: z.coerce
      .number({ error: 'Jumlah harus berupa angka' })
      .int('Jumlah stok harus bilangan bulat'),
    reference_type: z
      .enum(['purchase', 'stock_opname', 'return_in'])
      .default('purchase'),
    notes: z
      .string()
      .trim()
      .max(255, 'Catatan maksimal 255 karakter')
      .optional()
      .default(''),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'in' && data.qty <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['qty'],
        message: 'Jumlah stok masuk harus lebih dari 0',
      });
    }
    if (data.type === 'adjustment' && data.qty === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['qty'],
        message: 'Selisih penyesuaian tidak boleh 0 (gunakan angka + atau -)',
      });
    }
  });