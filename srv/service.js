const cds = require("@sap/cds");

module.exports = cds.service.impl(async function () {

    const db = await cds.connect.to("db");

    const {
        Products,
        Sales,
        Customers,
        Inventory
    } = cds.entities("sales.inventory");

    //const { Inventory } = cds.entities()


    // =====================================================
    // ACTIVATE PRODUCT
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
                .set({
                    status: "ACTIVE"
                })
                .where({ ID })
        );

        return await db.run(
            SELECT.one.from(Products).where({ ID })
        );
    });


    // =====================================================
    // DEACTIVATE PRODUCT
    // =====================================================

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
                .set({
                    status: "INACTIVE"
                })
                .where({ ID })
        );

        return await db.run(
            SELECT.one.from(Products).where({ ID })
        );
    });


    // =====================================================
    // GET PRODUCT STOCK
    // =====================================================

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
    // COMPLETE SALE
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
                .set({
                    status: "COMPLETED"
                })
                .where({ ID })
        );

        return await db.run(
            SELECT.one.from(Sales).where({ ID })
        );
    });


    // =====================================================
    // CANCEL SALE
    // =====================================================

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
                .set({
                    status: "CANCELLED"
                })
                .where({ ID })
        );

        return await db.run(
            SELECT.one.from(Sales).where({ ID })
        );
    });


    // =====================================================
    // GET TOTAL SALES
    // =====================================================

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

        // Customer validation
        if (!data.customer_ID) {
            return req.error(
                400,
                "Customer is required"
            );
        }

        // Product validation
        if (!data.product_ID) {
            return req.error(
                400,
                "Product is required"
            );
        }

        // Quantity validation
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


        // Check customer
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


        // Check product
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


        // Check product status
        if (product.status !== "ACTIVE") {
            return req.error(
                400,
                "Cannot create sale for an inactive product"
            );
        }


        // Check stock
        const quantity = Number(data.quantity);
        const availableStock = Number(product.stockQty || 0);

        if (quantity > availableStock) {
            return req.error(
                400,
                `Insufficient stock. Available stock: ${availableStock}`
            );
        }


        // Calculate price
        const unitPrice = Number(product.unitPrice || 0);

        data.unitPrice = unitPrice;

        data.totalAmount =
            quantity * unitPrice;


        // Sale date
        if (!data.saleDate) {
            data.saleDate =
                new Date().toISOString();
        }


        // Default status
        if (!data.status) {
            data.status = "CREATED";
        }

    });

    


    this.on('adjustStock', async (req) => {
        const { inventoryID, quantity } = req.data;
        if (!inventoryID) {
            req.error(400, "inventoryId is required");
        }
        if (!quantity || quantity < 0) {
            req.error(400, "enter the Quantity");
        }
        const demo = await SELECT.one.from(Inventory).where({ ID: inventoryID });

        console.log(demo);
       

        if (!demo) {
            req.error(400, "record not found");
        }

        const newStock = demo.stockQty + quantity
        console.log(newStock);

        if (newStock <= 0) {
            req.error(400, "newStock cannot be negative");
        }
        const stock = await UPDATE(Inventory).set({
            stockQty: newStock

        }).where({ ID: inventoryID });
        //console.log(stock);

       const updated = await SELECT.one.from(Inventory).where({ ID: inventoryID });
        console.log(updated);
        return updated;
    })

    this.on('reserveStock', async (req)=>{
        const{inventoryID, quantity}=req.data;

        if(!inventoryID){
            req.error(400, "inventoryID is required");
        }
        if(!quantity){
            req.error(400, "quantity id required");
        }
        const reserve=await SELECT.one.from(Inventory).where({ID:inventoryID});
        console.log(reserve);

        if(!reserve){
            req.error(400, "record not found");
        };

        const availableStock = reserve.stockQty-reserve.reservedQty;
        //console.log(availableStock);

        if(quantity>availableStock){
            req.error(400,"out of Stock");
        }
        const updatedreserve = await UPDATE(Inventory).set({
            reservedQty: reserve.reservedQty + quantity
        }).where({ ID: inventoryID });
        //console.log(updatedreserve);
        const totalReserved= await SELECT.one.from(Inventory).where({ID:inventoryID});
        return totalReserved;

    });

    this.on('releaseStock', async (req)=>{
        const {inventoryID, quantity}=req.data;
        if(!inventoryID){
            req.error(400, "inventoryID is required");
        }
        if(!quantity){
            req.error(400, "quantity id required");
        }
        const release=await SELECT.one.from(Inventory).where({ID:inventoryID});
        console.log(release);

        if(!release){
            req.error(400, "record not found");
        };

        if(quantity > release.reservedQty){
            req.error(400, "rerservedQty Exceeds");
        }

        const updatedreserve=await UPDATE(Inventory).set({
            reservedQty : release.reservedQty-quantity
        }).where({ID:inventoryID});
        return updatedreserve;
    });


        






});