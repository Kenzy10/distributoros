'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgContext } from '@/lib/supabase/get-active-org';
import { productSchema, updateProductSchema } from '@/lib/validations/product';

export type ProductActionState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function createProductAction(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const { supabase, user, organizationId } = await getActiveOrgContext();

  const parsed = productSchema.safeParse({
    sku: formData.get('sku'),
    name: formData.get('name'),
    category: formData.get('category') ?? '',
    unit: formData.get('unit'),
    cost_price: formData.get('cost_price'),
    wholesale_price: formData.get('wholesale_price'),
    selling_price: formData.get('selling_price'),
    min_stock_alert: formData.get('min_stock_alert') || 5,
    initial_stock: formData.get('initial_stock') || 0,
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { initial_stock, category, ...productFields } = parsed.data;

  // 1. Simpan master produk dengan current_stock = 0 (akan di-update oleh ledger jika initial_stock > 0)
  const { data: createdProduct, error: insertError } = await supabase
    .from('products')
    .insert({
      ...productFields,
      category: category || null,
      organization_id: organizationId,
      current_stock: 0,
    })
    .select('id, name')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      return {
        fieldErrors: {
          sku: ['Kode SKU ini sudah terdaftar di perusahaan Anda.'],
        },
      };
    }
    return { error: `Gagal menyimpan produk: ${insertError.message}` };
  }

  // 2. Jika ada stok awal, catat ke inventory_movements agar trigger sinkronisasi stok berjalan
  if (initial_stock > 0 && createdProduct) {
    const { error: moveError } = await supabase
      .from('inventory_movements')
      .insert({
        organization_id: organizationId,
        product_id: createdProduct.id,
        type: 'in',
        qty: initial_stock,
        reference_type: 'initial_stock',
        notes: 'Saldo stok awal saat pembuatan produk',
        created_by: user.id,
      });

    if (moveError) {
      return {
        error: `Produk dibuat, namun gagal mencatat stok awal: ${moveError.message}`,
      };
    }
  }

  revalidatePath('/products');
  revalidatePath('/inventory');
  revalidatePath('/');

  return { success: `Produk "${createdProduct.name}" berhasil ditambahkan.` };
}

export async function updateProductAction(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const { supabase, organizationId } = await getActiveOrgContext();

  const parsed = updateProductSchema.safeParse({
    id: formData.get('id'),
    sku: formData.get('sku'),
    name: formData.get('name'),
    category: formData.get('category') ?? '',
    unit: formData.get('unit'),
    cost_price: formData.get('cost_price'),
    wholesale_price: formData.get('wholesale_price'),
    selling_price: formData.get('selling_price'),
    min_stock_alert: formData.get('min_stock_alert') || 5,
    is_active: formData.get('is_active') === 'true',
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { id, category, ...fields } = parsed.data;

  const { error } = await supabase
    .from('products')
    .update({
      ...fields,
      category: category || null,
    })
    .eq('id', id)
    .eq('organization_id', organizationId);

  if (error) {
    if (error.code === '23505') {
      return {
        fieldErrors: {
          sku: ['Kode SKU ini sudah digunakan oleh produk lain.'],
        },
      };
    }
    return { error: `Gagal memperbarui produk: ${error.message}` };
  }

  revalidatePath('/products');
  revalidatePath('/inventory');
  revalidatePath('/');

  return { success: 'Data produk berhasil diperbarui.' };
}
export async function toggleProductStatusAction(id: string, nextActive: boolean) {
  const { supabase, organizationId } = await getActiveOrgContext();
  const { error } = await supabase
    .from('products')
    .update({ is_active: nextActive })
    .eq('id', id)
    .eq('organization_id', organizationId);
  if (error) return { error: error.message };
  revalidatePath('/products');
  return { success: nextActive ? 'Produk diaktifkan.' : 'Produk dinonaktifkan.' };
}

export async function deleteProductAction(id: string) {
  const { supabase, organizationId } = await getActiveOrgContext();
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)
    .eq('organization_id', organizationId);
  if (error) {
    return {
      error: error.code === '23503'
        ? 'Produk sudah dipakai transaksi. Gunakan tombol Nonaktif.'
        : error.message,
    };
  }
  revalidatePath('/products');
  return { success: 'Produk berhasil dihapus.' };
}
