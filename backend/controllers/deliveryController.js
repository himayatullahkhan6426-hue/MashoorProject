
const pool = require("../config/database");

// Get active products for the delivery form
async function getDeliveryProducts(req, res) {
  try {
    const result = await pool.query(
      `
        SELECT
          id,
          product_name,
          category,
          selling_price,
          stock_quantity
        FROM products
        WHERE is_active = TRUE
        ORDER BY product_name ASC
      `
    );

    return res.json({
      success: true,
      products: result.rows,
    });
  } catch (error) {
    console.error("Get delivery products error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load products.",
    });
  }
}

// Create a new shop delivery
async function createDelivery(req, res) {
  const client = await pool.connect();

  try {
    const { id: shopId } = req.params;
    const { items, discount = 0, notes = "" } = req.body;

    // Validate items
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please add at least one product.",
      });
    }

    const parsedDiscount = Number(discount);

    if (!Number.isFinite(parsedDiscount) || parsedDiscount < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid discount amount.",
      });
    }

    const productIds = [];
    const quantities = new Map();

    for (const item of items) {
      const productId = Number(item.product_id);
      const quantity = Number(item.quantity);

      if (
        !Number.isSafeInteger(productId) ||
        productId <= 0 ||
        !Number.isSafeInteger(quantity) ||
        quantity <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid product or quantity.",
        });
      }

      if (quantities.has(productId)) {
        return res.status(400).json({
          success: false,
          message: "A product cannot be added more than once.",
        });
      }

      productIds.push(productId);
      quantities.set(productId, quantity);
    }

    await client.query("BEGIN");

    // Verify shop
    const shopResult = await client.query(
      `
        SELECT id
        FROM shops
        WHERE id = $1 AND is_active = TRUE
        FOR UPDATE
      `,
      [shopId]
    );

    if (shopResult.rowCount === 0) {
      throw new Error("ACTIVE_SHOP_NOT_FOUND");
    }

    // Lock products to prevent simultaneous stock changes
    const productsResult = await client.query(
      `
        SELECT
          id,
          product_name,
          selling_price,
          stock_quantity,
          is_active
        FROM products
        WHERE id = ANY($1::bigint[])
        FOR UPDATE
      `,
      [productIds]
    );

    if (productsResult.rowCount !== productIds.length) {
      throw new Error("PRODUCT_NOT_FOUND");
    }

    const productsMap = new Map(
      productsResult.rows.map((product) => [
        String(product.id),
        product,
      ])
    );

    let subtotal = 0;
    const deliveryItems = [];

    for (const productId of productIds) {
      const product = productsMap.get(String(productId));
      const quantity = quantities.get(productId);

      if (!product.is_active) {
        throw new Error("INACTIVE_PRODUCT");
      }

      if (Number(product.stock_quantity) < quantity) {
        throw new Error(
          `INSUFFICIENT_STOCK:${product.product_name}`
        );
      }

      const unitPrice = Number(product.selling_price);

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new Error("INVALID_PRODUCT_PRICE");
      }

      const lineTotal = Number(
        (unitPrice * quantity).toFixed(2)
      );

      subtotal += lineTotal;

      deliveryItems.push({
        product_id: product.id,
        product_name: product.product_name,
        quantity,
        unit_price: unitPrice,
        line_total: lineTotal,
      });
    }

    subtotal = Number(subtotal.toFixed(2));

    if (parsedDiscount > subtotal) {
      throw new Error("DISCOUNT_EXCEEDS_SUBTOTAL");
    }

    const totalAmount = Number(
      (subtotal - parsedDiscount).toFixed(2)
    );

    // Generate invoice number
    const invoiceNumber =
      `MN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Create delivery
    const deliveryResult = await client.query(
      `
        INSERT INTO deliveries (
          shop_id,
          invoice_number,
          delivery_date,
          subtotal,
          discount,
          total_amount,
          notes
        )
        VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        shopId,
        invoiceNumber,
        subtotal,
        parsedDiscount,
        totalAmount,
        notes,
      ]
    );

    const delivery = deliveryResult.rows[0];

    // Save delivery items and update stock
    for (const item of deliveryItems) {
      await client.query(
        `
          INSERT INTO delivery_items (
            delivery_id,
            product_id,
            product_name,
            quantity,
            unit_price,
            line_total
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          delivery.id,
          item.product_id,
          item.product_name,
          item.quantity,
          item.unit_price,
          item.line_total,
        ]
      );

      await client.query(
        `
          UPDATE products
          SET
            stock_quantity = stock_quantity - $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `,
        [item.quantity, item.product_id]
      );
    }

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Delivery created successfully.",
      delivery,
      items: deliveryItems,
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Create delivery error:", error.message);

    if (error.message === "ACTIVE_SHOP_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Active shop not found.",
      });
    }

    if (error.message === "PRODUCT_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "One or more products were not found.",
      });
    }

    if (error.message === "INACTIVE_PRODUCT") {
      return res.status(400).json({
        success: false,
        message: "An inactive product cannot be delivered.",
      });
    }

    if (error.message.startsWith("INSUFFICIENT_STOCK:")) {
      const productName = error.message.split(":")[1];

      return res.status(400).json({
        success: false,
        message: `Insufficient stock for ${productName}.`,
      });
    }

    if (error.message === "DISCOUNT_EXCEEDS_SUBTOTAL") {
      return res.status(400).json({
        success: false,
        message: "Discount cannot exceed subtotal.",
      });
    }

    if (error.message === "INVALID_PRODUCT_PRICE") {
      return res.status(400).json({
        success: false,
        message: "A product has an invalid selling price.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to create delivery.",
    });

  } finally {
    client.release();
  }
}

module.exports = {
  getDeliveryProducts,
  createDelivery,
};
