
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
            return req.error(
                400,
                "Product ID is required"
            );
        }

        const product = await db.run(
            SELECT.one
                .from(Products)
                .where({ ID })
        );

        if (!product) {
            return req.error(
                404,
                "Product not found"
            );
        }

        await db.run(
            UPDATE(Products)
                .set({
                    status: "Available"
                })
                .where({ ID })
        );

        return await db.run(
            SELECT.one
                .from(Products)
                .where({ ID })
        );
    });


    this.on("deactivateProduct", async (req) => {

        const { ID } = req.data;

        if (!ID) {
            return req.error(
                400,
                "Product ID is required"
            );
        }

        const product = await db.run(
            SELECT.one
                .from(Products)
                .where({ ID })
        );

        if (!product) {
            return req.error(
                404,
                "Product not found"
            );
        }

        await db.run(
            UPDATE(Products)
                .set({
                    status: "Out Of Stock"
                })
                .where({ ID })
        );

        return await db.run(
            SELECT.one
                .from(Products)
                .where({ ID })
        );
    });


    this.on("getProductStock", async (req) => {

        const { ID } = req.data;

        if (!ID) {
            return req.error(
                400,
                "Product ID is required"
            );
        }

        const product = await db.run(
            SELECT.one
                .from(Products)
                .columns("stockQty")
                .where({ ID })
        );

        if (!product) {
            return req.error(
                404,
                "Product not found"
            );
        }

        return Number(
            product.stockQty || 0
        );
    });


    // =====================================================
    // SALES
    // =====================================================

    // =====================================================
    // COMPLETE SALE
    // =====================================================
    //
    // Sale lifecycle:
    //
    // CREATE SALE
    //     ↓
    // PENDING
    //     ↓
    // COMPLETE SALE
    //     ↓
    // COMPLETED
    //     ↓
    // Inventory stock decreases
    //
    // IMPORTANT:
    // Inventory is NOT decreased during CREATE.
    //
    // =====================================================

    this.on("completeSale", async (req) => {

        const { ID } = req.data;

        if (!ID) {
            return req.error(
                400,
                "Sale ID is required"
            );
        }


        // -------------------------------------------------
        // Find Sale
        // -------------------------------------------------

        const sale = await db.run(
            SELECT.one
                .from(Sales)
                .where({ ID })
        );

        if (!sale) {
            return req.error(
                404,
                "Sale not found"
            );
        }


        // -------------------------------------------------
        // Check Sale Status
        // -------------------------------------------------

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


        if (sale.status !== "PENDING") {

            return req.error(
                400,
                `Only pending sales can be completed. Current status: ${sale.status}`
            );
        }


        // -------------------------------------------------
        // Validate Sale Product
        // -------------------------------------------------

        const productID =
            sale.product_ID;

        const quantity =
            Number(
                sale.quantity || 0
            );


        if (!productID) {

            return req.error(
                400,
                "Sale product is missing"
            );
        }


        if (quantity <= 0) {

            return req.error(
                400,
                "Sale quantity must be greater than zero"
            );
        }


        // -------------------------------------------------
        // Find Inventory
        // -------------------------------------------------

        const inventory =
            await db.run(
                SELECT.one
                    .from(Inventory)
                    .where({
                        product_ID: productID
                    })
            );


        if (!inventory) {

            return req.error(
                404,
                "Inventory record not found for this product"
            );
        }


        // -------------------------------------------------
        // Check Available Stock
        // -------------------------------------------------
        //
        // Available Stock =
        // stockQty - reservedQty
        //
        // The sale can only be completed when
        // sufficient stock is available.
        //
        // -------------------------------------------------

        const currentInventoryStock =
            Number(
                inventory.stockQty || 0
            );

        const reservedQty =
            Number(
                inventory.reservedQty || 0
            );

        const availableStock =
            currentInventoryStock -
            reservedQty;


        if (quantity > availableStock) {

            return req.error(
                400,
                `Insufficient stock. Available stock: ${availableStock}`
            );
        }


        // -------------------------------------------------
        // Calculate New Inventory Stock
        // -------------------------------------------------

        const newInventoryStock =
            currentInventoryStock -
            quantity;


        // -------------------------------------------------
        // Safety Check
        // -------------------------------------------------

        if (newInventoryStock < 0) {

            return req.error(
                400,
                "Inventory stock cannot become negative"
            );
        }


        // -------------------------------------------------
        // Update Inventory Stock
        // -------------------------------------------------

        await db.run(
            UPDATE(Inventory)
                .set({
                    stockQty:
                        newInventoryStock
                })
                .where({
                    ID: inventory.ID
                })
        );


        // -------------------------------------------------
        // Find Product
        // -------------------------------------------------

        const product =
            await db.run(
                SELECT.one
                    .from(Products)
                    .where({
                        ID: productID
                    })
            );


        if (!product) {

            return req.error(
                404,
                "Product not found"
            );
        }


        // -------------------------------------------------
        // Synchronize Product Stock
        // -------------------------------------------------
        //
        // Product stock becomes exactly equal
        // to Inventory stock.
        //
        // -------------------------------------------------

        await db.run(
            UPDATE(Products)
                .set({
                    stockQty:
                        newInventoryStock
                })
                .where({
                    ID: productID
                })
        );


        // -------------------------------------------------
        // Update Sale Status
        // -------------------------------------------------

        await db.run(
            UPDATE(Sales)
                .set({
                    status: "COMPLETED"
                })
                .where({
                    ID
                })
        );


        // -------------------------------------------------
        // Return Updated Sale
        // -------------------------------------------------

        return await db.run(
            SELECT.one
                .from(Sales)
                .where({ ID })
        );
    });


    // =====================================================
    // CANCEL SALE
    // =====================================================

    this.on("cancelSale", async (req) => {

        const { ID } = req.data;

        if (!ID) {
            return req.error(
                400,
                "Sale ID is required"
            );
        }

        const sale = await db.run(
            SELECT.one
                .from(Sales)
                .where({ ID })
        );

        if (!sale) {
            return req.error(
                404,
                "Sale not found"
            );
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
                .set({
                    status: "CANCELLED"
                })
                .where({ ID })
        );

        return await db.run(
            SELECT.one
                .from(Sales)
                .where({ ID })
        );
    });


    this.on("getTotalSales", async () => {

        const result = await db.run(
            SELECT.one
                .from(Sales)
                .columns(
                    "sum(totalAmount) as totalSales"
                )
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
    //
    // Product status is NOT checked.
    //
    // Inventory is the source of truth.
    //
    // Available Stock =
    // stockQty - reservedQty
    //
    // Sale Number is generated automatically.
    //
    // Initial Status = PENDING
    //
    // IMPORTANT:
    // Inventory stock is NOT decreased here.
    //
    // =====================================================

    this.before("CREATE", "Sales", async (req) => {

        const data = req.data;


        // -------------------------------------------------
        // Basic validation
        // -------------------------------------------------

        if (!data.customer_ID) {
            return req.error(
                400,
                "Customer is required"
            );
        }

        if (!data.product_ID) {
            return req.error(
                400,
                "Product is required"
            );
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


        // -------------------------------------------------
        // Check customer
        // -------------------------------------------------

        const customer = await db.run(
            SELECT.one
                .from(Customers)
                .where({
                    ID: data.customer_ID
                })
        );

        if (!customer) {
            return req.error(
                404,
                "Customer not found"
            );
        }


        // -------------------------------------------------
        // Check product
        // -------------------------------------------------

        const product = await db.run(
            SELECT.one
                .from(Products)
                .where({
                    ID: data.product_ID
                })
        );

        if (!product) {
            return req.error(
                404,
                "Product not found"
            );
        }


        // -------------------------------------------------
        // IMPORTANT
        // -------------------------------------------------
        //
        // Product status is intentionally NOT checked.
        //
        // Sales are controlled by Inventory stock.
        //
        // -------------------------------------------------


        // -------------------------------------------------
        // Find Inventory for Product
        // -------------------------------------------------

        const inventory = await db.run(
            SELECT.one
                .from(Inventory)
                .where({
                    product_ID: data.product_ID
                })
        );

        if (!inventory) {
            return req.error(
                404,
                "Inventory record not found for this product"
            );
        }


        // -------------------------------------------------
        // Check Available Inventory Stock
        // -------------------------------------------------

        const quantity =
            Number(data.quantity);

        const inventoryStock =
            Number(inventory.stockQty || 0);

        const reservedQty =
            Number(inventory.reservedQty || 0);

        const availableStock =
            inventoryStock - reservedQty;


        if (quantity > availableStock) {

            return req.error(
                400,
                `Insufficient stock. Available stock: ${availableStock}`
            );
        }


        // -------------------------------------------------
        // Generate Sale Number
        // -------------------------------------------------
        //
        // Example:
        //
        // SO00001
        // SO00002
        // SO00003
        //
        // -------------------------------------------------

        if (!data.saleNumber) {

            const lastSale = await db.run(
                SELECT.one
                    .from(Sales)
                    .columns("saleNumber")
                    .orderBy(
                        "saleNumber desc"
                    )
            );

            let nextNumber = 1;


            if (
                lastSale &&
                lastSale.saleNumber
            ) {

                const lastNumber =
                    parseInt(
                        String(
                            lastSale.saleNumber
                        ).replace(
                            "SO",
                            ""
                        ),
                        10
                    );


                if (
                    !Number.isNaN(
                        lastNumber
                    )
                ) {

                    nextNumber =
                        lastNumber + 1;
                }
            }


            data.saleNumber =
                "SO" +
                String(
                    nextNumber
                ).padStart(
                    5,
                    "0"
                );
        }


        // -------------------------------------------------
        // Set Unit Price
        // -------------------------------------------------

        const unitPrice =
            Number(
                product.unitPrice || 0
            );

        data.unitPrice =
            unitPrice;


        // -------------------------------------------------
        // Calculate Total Amount
        // -------------------------------------------------

        data.totalAmount =
            quantity *
            unitPrice;


        // -------------------------------------------------
        // Sale Date
        // -------------------------------------------------

        if (!data.saleDate) {

            data.saleDate =
                new Date().toISOString();
        }


        // -------------------------------------------------
        // Sale Status
        // -------------------------------------------------
        //
        // New sales are always PENDING.
        //
        // Inventory is NOT changed.
        //
        // -------------------------------------------------

        data.status =
            "PENDING";
    });


    // =====================================================
    // AFTER CREATE SALE
    // =====================================================
    //
    // IMPORTANT:
    //
    // There is intentionally NO inventory update here.
    //
    // Inventory stock is decreased only inside
    // completeSale().
    //
    // CREATE SALE:
    //
    // Inventory = 150
    // Sale      = 5
    //
    // After CREATE:
    //
    // Inventory = 150
    // Sale      = PENDING
    //
    // After COMPLETE:
    //
    // Inventory = 145
    // Sale      = COMPLETED
    //
    // =====================================================

    this.after("CREATE", "Sales", async (sale, req) => {

        // No inventory update here.

        // Sale is created as PENDING.
        //
        // Stock will be decreased only when
        // completeSale action is executed.

        return;
    });


    // =====================================================
    // INVENTORY - ADJUST STOCK
    // =====================================================

    this.on("adjustStock", async (req) => {

        const {
            inventoryID,
            quantity
        } = req.data;


        // -------------------------------------------------
        // Validation
        // -------------------------------------------------

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


        // -------------------------------------------------
        // Find Inventory
        // -------------------------------------------------

        const inventory =
            await db.run(
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


        // -------------------------------------------------
        // Calculate New Stock
        // -------------------------------------------------

        const currentStock =
            Number(
                inventory.stockQty || 0
            );

        const addedQuantity =
            Number(quantity);

        const newStock =
            currentStock +
            addedQuantity;


        // -------------------------------------------------
        // Update Inventory
        // -------------------------------------------------

        await db.run(
            UPDATE(Inventory)
                .set({
                    stockQty: newStock
                })
                .where({
                    ID: inventoryID
                })
        );


        // -------------------------------------------------
        // Check Product Link
        // -------------------------------------------------

        if (!inventory.product_ID) {

            return req.error(
                400,
                "Inventory is not linked to a product"
            );
        }


        // -------------------------------------------------
        // Find Product
        // -------------------------------------------------

        const product =
            await db.run(
                SELECT.one
                    .from(Products)
                    .where({
                        ID: inventory.product_ID
                    })
            );


        if (!product) {

            return req.error(
                404,
                "Product linked to inventory was not found"
            );
        }


        // -------------------------------------------------
        // Synchronize Product Stock
        // -------------------------------------------------

        await db.run(
            UPDATE(Products)
                .set({
                    stockQty: newStock
                })
                .where({
                    ID: inventory.product_ID
                })
        );


        return (
            "Stock adjusted successfully. " +
            "Inventory stock: " +
            newStock +
            ", Product stock: " +
            newStock
        );
    });


    // =====================================================
    // RESERVE STOCK
    // =====================================================

    this.on("reserveStock", async (req) => {

        const {
            inventoryID,
            quantity
        } = req.data;


        // -------------------------------------------------
        // Validation
        // -------------------------------------------------

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


        // -------------------------------------------------
        // Find Inventory
        // -------------------------------------------------

        const inventory =
            await db.run(
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


        // -------------------------------------------------
        // Calculate Available Stock
        // -------------------------------------------------

        const stockQty =
            Number(
                inventory.stockQty || 0
            );

        const reservedQty =
            Number(
                inventory.reservedQty || 0
            );

        const requestedQty =
            Number(quantity);

        const availableStock =
            stockQty -
            reservedQty;


        // -------------------------------------------------
        // Check Available Stock
        // -------------------------------------------------

        if (
            requestedQty >
            availableStock
        ) {

            return req.error(
                400,
                `Insufficient available stock. Available stock: ${availableStock}`
            );
        }


        // -------------------------------------------------
        // Calculate New Reserved Quantity
        // -------------------------------------------------

        const newReservedQty =
            reservedQty +
            requestedQty;


        // -------------------------------------------------
        // Update Inventory
        // -------------------------------------------------

        await db.run(
            UPDATE(Inventory)
                .set({
                    reservedQty:
                        newReservedQty
                })
                .where({
                    ID: inventoryID
                })
        );


        return (
            "Stock reserved successfully. " +
            "Reserved quantity: " +
            newReservedQty
        );
    });


    // =====================================================
    // RELEASE STOCK
    // =====================================================

    this.on("releaseStock", async (req) => {

        const {
            inventoryID,
            quantity
        } = req.data;


        // -------------------------------------------------
        // Validation
        // -------------------------------------------------

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


        // -------------------------------------------------
        // Find Inventory
        // -------------------------------------------------

        const inventory =
            await db.run(
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


        // -------------------------------------------------
        // Current Reserved Quantity
        // -------------------------------------------------

        const reservedQty =
            Number(
                inventory.reservedQty || 0
            );

        const requestedQty =
            Number(quantity);


        // -------------------------------------------------
        // Check Reserved Quantity
        // -------------------------------------------------

        if (
            requestedQty >
            reservedQty
        ) {

            return req.error(
                400,
                `Cannot release ${requestedQty}. Reserved quantity is only ${reservedQty}`
            );
        }


        // -------------------------------------------------
        // Calculate New Reserved Quantity
        // -------------------------------------------------

        const newReservedQty =
            reservedQty -
            requestedQty;


        // -------------------------------------------------
        // Update Inventory
        // -------------------------------------------------

        await db.run(
            UPDATE(Inventory)
                .set({
                    reservedQty:
                        newReservedQty
                })
                .where({
                    ID: inventoryID
                })
        );


        return (
            "Stock released successfully. " +
            "Reserved quantity: " +
            newReservedQty
        );
    });

});
