import { ProductManager } from '@/components/products/product-manager';
import { getActiveOrgContext } from '@/lib/supabase/get-active-org';

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const { supabase, organizationId } = await getActiveOrgContext();
  const params = await searchParams;

  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Gagal memuat katalog produk: ${error.message}`);
  }

  return (
    <ProductManager
      products={products ?? []}
      initialQuery={params.q ?? ''}
      initialFilter={params.filter ?? 'all'}
    />
  );
}