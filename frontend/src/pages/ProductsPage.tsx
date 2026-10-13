import { getProducts } from '../api/products';
import { useApiResource } from '../api/useApiResource';
import { Icon } from '../components/Icon';
import { EmptyState } from '../components/EmptyState';

export function ProductsPage() {
  const { data, loading, error, reload } = useApiResource(getProducts);
  return (
    <main>
      <div className="page-heading">
        <div>
          <h1>Products</h1>
          <p className="page-description">
            Your product catalogue and current unit prices.
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          aria-label="Refresh products"
        >
          <Icon name="refresh" size={15} />
          Refresh
        </button>
      </div>
      {loading && (
        <p className="notice" role="status">
          Loading products…
        </p>
      )}
      {error && (
        <p className="notice notice-error" role="alert">
          Could not load products: {error}
        </p>
      )}
      {data &&
        (data.length === 0 ? (
          <div className="panel">
            <EmptyState
              title="No products available."
              description="Your product catalogue will appear here once products are available."
              icon="products"
            />
          </div>
        ) : (
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h2>Product catalogue</h2>
                <p className="panel-description">
                  Prices are shown in minor units.
                </p>
              </div>
              <span className="badge badge-neutral">
                {data.length} products
              </span>
            </div>
            <div
              className="table-scroll table-caption-hidden"
              tabIndex={0}
              role="region"
              aria-label="Scrollable product catalogue"
            >
              <table className="products-table">
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
                      <td>
                        <span className="sku">{product.sku}</span>
                      </td>
                      <th scope="row">
                        <div className="outlet-cell">
                          <span className="outlet-icon">
                            <Icon name="products" size={15} />
                          </span>
                          {product.name}
                        </div>
                      </th>
                      <td>{product.unit_price_minor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="panel-footer">
              <span>{data.length} products</span>
              <span>Catalogue managed by your sales system.</span>
            </div>
          </div>
        ))}
    </main>
  );
}
