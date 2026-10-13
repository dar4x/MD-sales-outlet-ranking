import { getProducts } from '../api/products';
import { useApiResource } from '../api/useApiResource';

export function ProductsPage() {
  const { data, loading, error, reload } = useApiResource(getProducts);
  return (
    <main>
      <h1>Products</h1>
      <button type="button" onClick={reload} disabled={loading}>
        Refresh products
      </button>
      {loading && <p role="status">Loading products…</p>}
      {error && <p role="alert">Could not load products: {error}</p>}
      {data &&
        (data.length === 0 ? (
          <p>No products available.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <caption>Product catalogue</caption>
              <thead>
                <tr>
                  <th scope="col">SKU</th>
                  <th scope="col">Product</th>
                  <th scope="col">Price (minor units)</th>
                </tr>
              </thead>
              <tbody>
                {data.map((product) => (
                  <tr key={product.product_id}>
                    <td>{product.sku}</td>
                    <th scope="row">{product.name}</th>
                    <td>{product.unit_price_minor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </main>
  );
}
