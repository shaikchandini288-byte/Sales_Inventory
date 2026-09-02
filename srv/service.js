const cds = require("@sap/cds");

module.exports = cds.service.impl(async function () {

    const db = await cds.connect.to("db");

    const {
        Products,
        Sales,
        Customers,
        Inventory,
        Warehouses
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



    this.on("completeSale", async (req) => {

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


        if (sale.status === "Cancelled") {

            return req.error(
                400,
                "Cancelled sale cannot be Completed"
            );
        }


        if (sale.status === "Completed") {

            return req.error(
                400,
                "Sale is already Completed"
            );
        }


        if (sale.status !== "Pending") {

            return req.error(
                400,
                `Only Pending sales can be Completed. Current status: ${sale.status}`
            );
        }

        const productID =
            sale.product_ID;

        const warehouseID =
            sale.warehouse_ID;

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


        let inventory;

        if (warehouseID) {

            inventory = await db.run(
                SELECT.one
                    .from(Inventory)
                    .where({
                        product_ID:
                            productID,

                        warehouse_ID:
                            warehouseID
                    })
            );

        } else {

            inventory = await db.run(
                SELECT.one
                    .from(Inventory)
                    .where({
                        product_ID:
                            productID
                    })
            );
        }


        if (!inventory) {

            if (warehouseID) {

                return req.error(
                    404,
                    "Inventory record not found for this product and warehouse"
                );

            } else {

                return req.error(
                    404,
                    "Inventory record not found for this product"
                );
            }
        }


        // -------------------------------------------------
        // Check Available Stock
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
                    ID:
                        inventory.ID
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
                        ID:
                            productID
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

        await db.run(
            UPDATE(Products)
                .set({
                    stockQty:
                        newInventoryStock
                })
                .where({
                    ID:
                        productID
                })
        );


        // -------------------------------------------------
        // Update Sale Status
        // -------------------------------------------------

        await db.run(
            UPDATE(Sales)
                .set({
                    status:
                        "Completed"
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
                .where({
                    ID
                })
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

        if (sale.status === "Completed") {

            return req.error(
                400,
                "Completed sale cannot be Cancelled"
            );
        }

        if (sale.status === "Cancelled") {

            return req.error(
                400,
                "Sale is already Cancelled"
            );
        }

        await db.run(
            UPDATE(Sales)
                .set({
                    status:
                        "Cancelled"
                })
                .where({
                    ID
                })
        );

        return await db.run(
            SELECT.one
                .from(Sales)
                .where({
                    ID
                })
        );
    });


    // =====================================================
    // GET TOTAL SALES
    // =====================================================

    this.on("getTotalSales", async () => {

        const result = await db.run(
            SELECT.one
                .from(Sales)
                .columns(
                    "sum(totalAmount) as totalSales"
                )
                .where({
                    status: {
                        "!=":
                            "Cancelled"
                    }
                })
        );

        return result?.totalSales || 0;
    });


    // =====================================================
    // BEFORE CREATE SALE
    // =====================================================
    //
    // Customer     -> Required
    // Product      -> Required
    // Quantity     -> Required
    // Warehouse    -> OPTIONAL
    //
    // Sale Number  -> Automatic
    // Status       -> Pending
    //
    // Inventory is NOT decreased here.
    //
    // =====================================================

    this.before("CREATE", "Sales", async (req) => {

        const data = req.data;


        // -------------------------------------------------
        // Customer Validation
        // -------------------------------------------------

        if (!data.customer_ID) {

            return req.error(
                400,
                "Customer is required"
            );
        }


        // -------------------------------------------------
        // Product Validation
        // -------------------------------------------------

        if (!data.product_ID) {

            return req.error(
                400,
                "Product is required"
            );
        }


        // -------------------------------------------------
        // Quantity Validation
        // -------------------------------------------------

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
        // Check Customer
        // -------------------------------------------------

        const customer =
            await db.run(
                SELECT.one
                    .from(Customers)
                    .where({
                        ID:
                            data.customer_ID
                    })
            );


        if (!customer) {

            return req.error(
                404,
                "Customer not found"
            );
        }


        // -------------------------------------------------
        // Check Product
        // -------------------------------------------------

        const product =
            await db.run(
                SELECT.one
                    .from(Products)
                    .where({
                        ID:
                            data.product_ID
                    })
            );


        if (!product) {

            return req.error(
                404,
                "Product not found"
            );
        }


        // -------------------------------------------------
        // Find Inventory
        // -------------------------------------------------
        //
        // Warehouse is optional.
        //
        // If warehouse is provided:
        //     Product + Warehouse
        //
        // If warehouse is NOT provided:
        //     Product only
        //
        // -------------------------------------------------

        let inventory;

        if (data.warehouse_ID) {

            inventory = await db.run(
                SELECT.one
                    .from(Inventory)
                    .where({
                        product_ID:
                            data.product_ID,

                        warehouse_ID:
                            data.warehouse_ID
                    })
            );

        } else {

            inventory = await db.run(
                SELECT.one
                    .from(Inventory)
                    .where({
                        product_ID:
                            data.product_ID
                    })
            );
        }


        if (!inventory) {

            if (data.warehouse_ID) {

                return req.error(
                    404,
                    "Inventory record not found for the selected product and warehouse"
                );

            } else {

                return req.error(
                    404,
                    "Inventory record not found for the selected product"
                );
            }
        }


        // -------------------------------------------------
        // Check Available Inventory Stock
        // -------------------------------------------------

        const quantity =
            Number(
                data.quantity
            );

        const inventoryStock =
            Number(
                inventory.stockQty || 0
            );

        const reservedQty =
            Number(
                inventory.reservedQty || 0
            );

        const availableStock =
            inventoryStock -
            reservedQty;


        if (quantity > availableStock) {

            return req.error(
                400,
                `Insufficient stock. Available stock: ${availableStock}`
            );
        }


        // =================================================
        // AUTOMATIC SALE NUMBER
        // =================================================
        //
        // The frontend does NOT generate this number.
        //
        // Existing:
        //
        // SO00001
        // SO00002
        // SO00003
        //
        // Highest = 3
        //
        // New = SO00004
        //
        // =================================================

        const allSales =
            await db.run(
                SELECT
                    .from(Sales)
                    .columns(
                        "saleNumber"
                    )
            );


        let highestSaleNumber = 0;


        for (
            const existingSale
            of allSales
        ) {

            if (
                !existingSale.saleNumber
            ) {
                continue;
            }


            const match =
                String(
                    existingSale.saleNumber
                )
                    .trim()
                    .match(
                        /^SO(\d+)$/i
                    );


            if (!match) {
                continue;
            }


            const currentNumber =
                parseInt(
                    match[1],
                    10
                );


            if (
                !Number.isNaN(
                    currentNumber
                ) &&
                currentNumber >
                    highestSaleNumber
            ) {

                highestSaleNumber =
                    currentNumber;
            }
        }


        // -------------------------------------------------
        // Generate Next Sale Number
        // -------------------------------------------------

        const nextSaleNumber =
            highestSaleNumber + 1;


        data.saleNumber =
            "SO" +
            String(
                nextSaleNumber
            ).padStart(
                5,
                "0"
            );


        // -------------------------------------------------
        // Unit Price
        // -------------------------------------------------

        const unitPrice =
            Number(
                product.unitPrice || 0
            );


        data.unitPrice =
            unitPrice;


        // -------------------------------------------------
        // Total Amount
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
        // Initial Status
        // -------------------------------------------------

        data.status =
            "Pending";
    });


    // =====================================================
    // AFTER CREATE SALE
    // =====================================================
    //
    // No inventory update here.
    //
    // CREATE:
    // Inventory = 150
    // Sale      = 5
    // Status    = Pending
    //
    // COMPLETE:
    // Inventory = 145
    // Sale      = Completed
    //
    // =====================================================

    this.after(
        "CREATE",
        "Sales",
        async (sale, req) => {

            // Intentionally empty.

            // Inventory stock is changed
            // only inside completeSale().

            return;
        }
    );


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
                        ID:
                            inventoryID
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
                    stockQty:
                        newStock
                })
                .where({
                    ID:
                        inventoryID
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
                        ID:
                            inventory.product_ID
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
                    stockQty:
                        newStock
                })
                .where({
                    ID:
                        inventory.product_ID
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
                        ID:
                            inventoryID
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
                    ID:
                        inventoryID
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
                        ID:
                            inventoryID
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
                    ID:
                        inventoryID
                })
        );


        return (
            "Stock released successfully. " +
            "Reserved quantity: " +
            newReservedQty
        );
    });

});

