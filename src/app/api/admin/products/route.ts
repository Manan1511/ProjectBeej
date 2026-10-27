import { isAdminRequestAuthenticated } from "@/lib/admin-auth";
import { getCardProducts } from "@/lib/storefront";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store, max-age=0" };
  if (!await isAdminRequestAuthenticated(request)) return Response.json({ error: "Admin sign-in is required." }, { status: 401, headers });
  try {
    const products = await getCardProducts();
    return Response.json({ products: products.map((product) => ({
      handle: product.handle,
      title: product.title,
      productType: product.productType,
      price: product.price,
      image: product.images[0]?.url || null,
    })) }, { headers });
  } catch {
    return Response.json({ error: "Shopify products could not be loaded. Try again." }, { status: 503, headers });
  }
}
