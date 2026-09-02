const cds = require("@sap/cds");

module.exports = cds.service.impl(async function () {

    const db = await cds.connect.to("db");

    const {
        Products,
        Sales,
        Customers,
        Inventory
    } = cds.entities("sales.inventory");


    // =====================================================
    // PRODUCT
    // =====================================================

    this.on("activateProduct", async (req) => {

        const { ID } = req.data;

        if (!ID) {
            return req.error(400, "Product ID is required");
        }

        const product = await db.run(
            SELECT.one.from(Products).where({ ID })
        );

        if (!product) {
            return req.error(404, "Product not found");
        }

        await db.run(
            UPDATE(Products)
                .set({ status: "ACTIVE" })
                .where({ ID })
        );

        return await db.run(
            SELECT.one.from(Products).where({ ID })
        );
    });


    this.on("deactivateProduct", async (req) => {

        const { ID } = req.data;

        if (!ID) {
            return req.error(400, "Product ID is required");
        }

        const product = await db.run(
            SELECT.one.from(Products).where({ ID })
        );

        if (!product) {
            return req.error(404, "Product not found");
        }

        await db.run(
            UPDATE(Products)
                .set({ status: "INACTIVE" })
                .where({ ID })
        );

        return await db.run(
            SELECT.one.from(Products).where({ ID })
        );
    });


    this.on("getProductStock", async (req) => {

        const { ID } = req.data;

        if (!ID) {
            return req.error(400, "Product ID is required");
        }

        const product = await db.run(
            SELECT.one
                .from(Products)
                .columns("stockQty")
                .where({ ID })
        );

        if (!product) {
            return req.error(404, "Product not found");
        }

        return product.stockQty || 0;
    });


    // =====================================================
    // SALES
    // =====================================================

    this.on("completeSale", async (req) => {

        const { ID } = req.data;

        if (!ID) {
            return req.error(400, "Sale ID is required");
        }

        const sale = await db.run(
            SELECT.one.from(Sales).where({ ID })
        );

        if (!sale) {
            return req.error(404, "Sale not found");
        }

        if (sale.status === "CANCELLED") {
            return req.error(
                400,
                "Cancelled sale cannot be completed"
            );
        }

        if (sale.status === "COMPLETED") {
            return req.error(
                400,
                "Sale is already completed"
            );
        }

        await db.run(
            UPDATE(Sales)
                .set({ status: "COMPLETED" })
                .where({ ID })
        );

        return await db.run(
            SELECT.one.from(Sales).where({ ID })
        );
    });


    this.on("cancelSale", async (req) => {

        const { ID } = req.data;

        if (!ID) {
            return req.error(400, "Sale ID is required");
        }

        const sale = await db.run(
            SELECT.one.from(Sales).where({ ID })
        );

        if (!sale) {
            return req.error(404, "Sale not found");
        }

        if (sale.status === "COMPLETED") {
            return req.error(
                400,
                "Completed sale cannot be cancelled"
            );
        }

        if (sale.status === "CANCELLED") {
            return req.error(
                400,
                "Sale is already cancelled"
            );
        }

        await db.run(
            UPDATE(Sales)
                .set({ status: "CANCELLED" })
                .where({ ID })
        );

        return await db.run(
            SELECT.one.from(Sales).where({ ID })
        );
    });


    this.on("getTotalSales", async () => {

        const result = await db.run(
            SELECT.one
                .from(Sales)
                .columns("sum(totalAmount) as totalSales")
                .where({
                    status: {
                        "!=": "CANCELLED"
                    }
                })
        );

        return result?.totalSales || 0;
    });


    // =====================================================
    // BEFORE CREATE SALE
    // =====================================================

    this.before("CREATE", "Sales", async (req) => {

        const data = req.data;

        if (!data.customer_ID) {
            return req.error(400, "Customer is required");
        }

        if (!data.product_ID) {
            return req.error(400, "Product is required");
        }

        if (
            data.quantity === undefined ||
            data.quantity === null ||
            Number(data.quantity) <= 0
        ) {
            return req.error(
                400,
                "Quantity must be greater than zero"
            );
        }

        const customer = await db.run(
            SELECT.one
                .from(Customers)
                .where({
                    ID: data.customer_ID
                })
        );

        if (!customer) {
            return req.error(404, "Customer not found");
        }

        const product = await db.run(
            SELECT.one
                .from(Products)
                .where({
                    ID: data.product_ID
                })
        );

        if (!product) {
            return req.error(404, "Product not found");
        }

        if (product.status !== "ACTIVE") {
            return req.error(
                400,
                "Cannot create sale for an inactive product"
            );
        }

        const quantity = Number(data.quantity);
        const availableStock =
            Number(product.stockQty || 0);

        if (quantity > availableStock) {
            return req.error(
                400,
                `Insufficient stock. Available stock: ${availableStock}`
            );
        }

        const unitPrice =
            Number(product.unitPrice || 0);

        data.unitPrice = unitPrice;
        data.totalAmount = quantity * unitPrice;

        if (!data.saleDate) {
            data.saleDate = new Date().toISOString();
        }

        if (!data.status) {
            data.status = "CREATED";
        }
    });


    // =====================================================
    // INVENTORY
    // =====================================================

    this.on("adjustStock", async (req) => {

        const { inventoryID, quantity } = req.data;

        if (!inventoryID) {
            return req.error(
                400,
                "inventoryID is required"
            );
        }

        if (
            quantity === undefined ||
            quantity === null ||
            Number(quantity) < 0
        ) {
            return req.error(
                400,
                "Quantity must be zero or greater"
            );
        }

        const inventory = await db.run(
            SELECT.one
                .from(Inventory)
                .where({
                    ID: inventoryID
                })
        );

        if (!inventory) {
            return req.error(
                404,
                "Inventory record not found"
            );
        }

        const currentStock =
            Number(inventory.stockQty || 0);

        const newStock =
            currentStock + Number(quantity);

        await db.run(
            UPDATE(Inventory)
                .set({
                    stockQty: newStock
                })
                .where({
                    ID: inventoryID
                })
        );

        return `Stock adjusted successfully. New stock: ${newStock}`;
    });


    // =====================================================
    // RESERVE STOCK
    // =====================================================

    this.on("reserveStock", async (req) => {

        const { inventoryID, quantity } = req.data;

        if (!inventoryID) {
            return req.error(
                400,
                "inventoryID is required"
            );
        }

        if (
            quantity === undefined ||
            quantity === null ||
            Number(quantity) <= 0
        ) {
            return req.error(
                400,
                "Quantity must be greater than zero"
            );
        }

        const inventory = await db.run(
            SELECT.one
                .from(Inventory)
                .where({
                    ID: inventoryID
                })
        );

        if (!inventory) {
            return req.error(
                404,
                "Inventory record not found"
            );
        }

        const stockQty =
            Number(inventory.stockQty || 0);

        const reservedQty =
            Number(inventory.reservedQty || 0);

        const requestedQty =
            Number(quantity);

        const availableStock =
            stockQty - reservedQty;

        if (requestedQty > availableStock) {
            return req.error(
                400,
                `Insufficient available stock. Available stock: ${availableStock}`
            );
        }

        await db.run(
            UPDATE(Inventory)
                .set({
                    reservedQty:
                        reservedQty + requestedQty
                })
                .where({
                    ID: inventoryID
                })
        );

        return `Stock reserved successfully. Reserved quantity: ${reservedQty + requestedQty}`;
    });


    // =====================================================
    // RELEASE STOCK
    // =====================================================

    this.on("releaseStock", async (req) => {

        const { inventoryID, quantity } = req.data;

        if (!inventoryID) {
            return req.error(
                400,
                "inventoryID is required"
            );
        }

        if (
            quantity === undefined ||
            quantity === null ||
            Number(quantity) <= 0
        ) {
            return req.error(
                400,
                "Quantity must be greater than zero"
            );
        }

        const inventory = await db.run(
            SELECT.one
                .from(Inventory)
                .where({
                    ID: inventoryID
                })
        );

        if (!inventory) {
            return req.error(
                404,
                "Inventory record not found"
            );
        }

        const reservedQty =
            Number(inventory.reservedQty || 0);

        const requestedQty =
            Number(quantity);

        if (requestedQty > reservedQty) {
            return req.error(
                400,
                `Cannot release ${requestedQty}. Reserved quantity is only ${reservedQty}`
            );
        }

        const newReservedQty =
            reservedQty - requestedQty;

        await db.run(
            UPDATE(Inventory)
                .set({
                    reservedQty: newReservedQty
                })
                .where({
                    ID: inventoryID
                })
        );

        return `Stock released successfully. Reserved quantity: ${newReservedQty}`;
    });

});