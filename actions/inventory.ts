'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgContext } from '@/lib/supabase/get-active-org';
import { inventoryMovementSchema } from '@/lib/validations/inventory';

export type InventoryActionState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function recordInventoryMovementAction(
  _prevState: InventoryActionState,
  formData: FormData
): Promise<InventoryActionState> {
  const { supabase, user, organizationId } = await getActiveOrgContext();

  const type = formData.get('type');
  const defaultRef = type === 'adjustment' ? 'stock_opname' : 'purchase';

  const parsed = inventoryMovementSchema.safeParse({
    product_id: formData.get('product_id'),
    type,
    qty: formData.get('qty'),
    reference_type: formData.get('reference_type') || defaultRef,
    notes: formData.get('notes') ?? '',
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { product_id, qty, reference_type, notes } = parsed.data;

  // Insert mutasi; trigger PostgreSQL trg_sync_product_stock otomatis memvalidasi & update current_stock
  const { error } = await supabase.from('inventory_movements').insert({
    organization_id: organizationId,
    product_id,
    type: parsed.data.type,
    qty,
    reference_type,
    notes: notes || null,
    created_by: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/inventory');
  revalidatePath('/products');
  revalidatePath('/');

  return {
    success:
      parsed.data.type === 'in'
        ? `Stok masuk sebanyak +${qty} berhasil dicatat.`
        : `Penyesuaian stok (${qty > 0 ? `+${qty}` : qty}) berhasil disimpan.`,
  };
}