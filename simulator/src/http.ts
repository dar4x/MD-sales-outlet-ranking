import type { Outlet, Product, SaleReceipt } from "./types.js";

export function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export async function sendReceipt(
  apiUrl: string,
  receipt: SaleReceipt,
  log: (message: string) => void = console.error,
  maxAttempts = 5,
): Promise<"created" | "duplicate" | "rejected" | "failed"> {
  // Serialize once: transport retries preserve every byte and all identities.
  const body = JSON.stringify(receipt);
  let backoffMs = 500;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetch(apiUrl + "/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(3000),
      });
      const responseBody = await response
        .text()
        .catch(() => "Response body unavailable.");
      if (response.status === 201) return "created";
      if (response.status === 200) return "duplicate";
      if (response.status === 409 || response.status === 422) {
        log("Rejected " + response.status + ": " + responseBody);
        return "rejected";
      }
      log("HTTP " + response.status + ": " + responseBody);
      if (response.status < 500 || response.status > 599) return "failed";
    } catch (error) {
      log("Network failure: " + String(error));
    }
    if (attempt + 1 < maxAttempts) {
      await pause(backoffMs);
      backoffMs = Math.min(backoffMs * 2, 5000);
    }
  }
  return "failed";
}

export async function loadCatalogue(
  apiUrl: string,
): Promise<{ outlets: Outlet[]; products: Product[] }> {
  let failure: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const outletResponse = await fetch(apiUrl + "/outlets", {
        signal: AbortSignal.timeout(3000),
      });
      if (!outletResponse.ok)
        throw new Error("Outlets HTTP " + outletResponse.status);
      const productResponse = await fetch(apiUrl + "/products", {
        signal: AbortSignal.timeout(3000),
      });
      if (!productResponse.ok)
        throw new Error("Products HTTP " + productResponse.status);
      const outletBody = (await outletResponse.json()) as { items: Outlet[] };
      const productBody = (await productResponse.json()) as {
        items: Product[];
      };
      if (
        !Array.isArray(outletBody.items) ||
        !Array.isArray(productBody.items) ||
        outletBody.items.length === 0 ||
        productBody.items.length === 0
      ) {
        throw new Error("The outlet and product catalogues must be nonempty.");
      }
      for (const outlet of outletBody.items) {
        if (
          typeof outlet.outlet_id !== "string" ||
          typeof outlet.name !== "string" ||
          typeof outlet.time_zone !== "string"
        ) {
          throw new Error("Invalid outlet catalogue response.");
        }
      }
      for (const product of productBody.items) {
        if (
          typeof product.product_id !== "string" ||
          typeof product.name !== "string" ||
          typeof product.sku !== "string" ||
          typeof product.unit_price_minor !== "string" ||
          !/^(0|[1-9][0-9]*)$/.test(product.unit_price_minor)
        ) {
          throw new Error("Invalid product catalogue response.");
        }
      }
      return { outlets: outletBody.items, products: productBody.items };
    } catch (error) {
      failure = error;
    }
    if (attempt < 3) await pause(500);
  }
  throw new Error("Startup failed after 4 attempts: " + String(failure));
}
