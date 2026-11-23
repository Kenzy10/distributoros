import { z } from 'zod';

export const orderItemInputSchema = z.object({
  product_id: z.string().uuid('Pilih produk yang valid'),
  qty: z.coerce
    .number({ error: 'Jumlah pesanan harus berupa angka' })
    .int('Jumlah pesanan harus bilangan bulat')
    .min(1, 'Jumlah minimal 1 unit'),
  unit_price: z.coerce
    .number({ error: 'Harga satuan harus berupa angka' })
    .min(0, 'Harga satuan tidak boleh negatif'),
});

export const createOrderSchema = z
  .object({
    customer_id: z.string().uuid('Pilih pelanggan terlebih dahulu'),
    discount_amount: z.coerce
      .number({ error: 'Diskon harus berupa angka' })
      .min(0, 'Diskon tidak boleh negatif')
      .default(0),
    notes: z
      .string()
      .trim()
      .max(300, 'Catatan maksimal 300 karakter')
      .optional()
      .default(''),
    submit_mode: z.enum(['draft', 'confirm'], {
      error: 'Mode penyimpanan pesanan tidak valid',
    }),
    items: z
      .array(orderItemInputSchema)
      .min(1, 'Pesanan harus memiliki minimal 1 item produk'),
  })
  .superRefine((data, ctx) => {
    const seenProducts = new Set<string>();
    data.items.forEach((item, index) => {
      if (seenProducts.has(item.product_id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'product_id'],
          message: 'Produk duplikat dalam satu pesanan. Gabungkan jumlahnya.',
        });
      }
      seenProducts.add(item.product_id);
    });

    const subtotal = data.items.reduce(
      (sum, item) => sum + item.qty * item.unit_price,
      0
    );

    if (data.discount_amount > subtotal) {
      ctx.addIssue({
        code: 'custom',
        path: ['discount_amount'],
        message: 'Diskon tidak boleh melebihi subtotal pesanan',
      });
    }
  });

export const updateOrderStatusSchema = z.object({
  order_id: z.string().uuid('ID pesanan tidak valid'),
  next_status: z.enum(
    ['confirmed', 'packed', 'shipped', 'completed', 'cancelled'],
    {
      error: 'Status tujuan tidak valid',
    }
  ),
});