sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Input",
    "sap/m/Label",
    "sap/m/VBox",
    "sap/m/Select",
    "sap/ui/core/Item",
    "../model/formatter"
], function (
    Controller,
    JSONModel,
    MessageToast,
    MessageBox,
    Dialog,
    Button,
    Input,
    Label,
    VBox,
    Select,
    Item,
    formatter
) {
    "use strict";

    return Controller.extend("sales.controller.View1", {

        formatter: formatter,

        // =========================================================
        // INIT
        // =========================================================

        onInit: function () {

            this.oLocalModel = new JSONModel({
                products: [],
                sales: [],
                customers: []
            });

            this.getView().setModel(
                this.oLocalModel,
                "local"
            );

            this.oSelectedProduct = null;
            this.oSelectedSale = null;

            this._loadProducts();
            this._loadSales();
            this._loadCustomers();

            // Inventory is loaded automatically by the named
            // OData V4 model declared in manifest.json.
            if (!this.getView().getModel("inventory")) {

                console.error(
                    "Inventory OData model is not available. Check manifest.json."
                );
            }
        },


        // =========================================================
        // LOAD PRODUCTS
        // =========================================================

        _loadProducts: async function () {

            try {

                const response = await fetch(
                    "/odata/v4/sales-inventory/Products?$expand=category"
                );

                if (!response.ok) {

                    throw new Error(
                        "Products request failed: " +
                        response.status +
                        " " +
                        response.statusText
                    );
                }

                const data = await response.json();

                this.oLocalModel.setProperty(
                    "/products",
                    data.value || []
                );

                /*
                 * Inventory Product Name uses the Product list.
                 * Refresh Inventory after Products are loaded.
                 */

                const oInventoryTable =
                    this.byId("inventoryTable");

                const oInventoryBinding =
                    oInventoryTable &&
                    oInventoryTable.getBinding("items");

                if (oInventoryBinding) {

                    oInventoryBinding.refresh();
                }

            } catch (error) {

                console.error(
                    "Product loading error:",
                    error
                );

                MessageBox.error(
                    "Unable to load Products.\n\n" +
                    this._getErrorMessage(error)
                );
            }
        },


        // =========================================================
        // LOAD SALES
        // =========================================================

        _loadSales: async function () {

            try {

                /*
                 * Sort Sales by saleDate in ascending order.
                 *
                 * Oldest sale  -> top
                 * Newest sale  -> bottom
                 */

                const response = await fetch(
                    "/odata/v4/sales-inventory/Sales?$expand=customer,product&$orderby=saleDate asc"
                );

                if (!response.ok) {

                    throw new Error(
                        "Sales request failed: " +
                        response.status +
                        " " +
                        response.statusText
                    );
                }

                const data = await response.json();

                this.oLocalModel.setProperty(
                    "/sales",
                    data.value || []
                );

            } catch (error) {

                console.error(
                    "Sales loading error:",
                    error
                );

                MessageBox.error(
                    "Unable to load Sales.\n\n" +
                    this._getErrorMessage(error)
                );
            }
        },


        // =========================================================
        // LOAD CUSTOMERS
        // =========================================================

        _loadCustomers: async function () {

            try {

                const response = await fetch(
                    "/odata/v4/sales-inventory/Customers"
                );

                if (!response.ok) {

                    throw new Error(
                        "Customers request failed: " +
                        response.status +
                        " " +
                        response.statusText
                    );
                }

                const data = await response.json();

                this.oLocalModel.setProperty(
                    "/customers",
                    data.value || []
                );

            } catch (error) {

                console.error(
                    "Customer loading error:",
                    error
                );

                MessageBox.error(
                    "Unable to load Customers.\n\n" +
                    this._getErrorMessage(error)
                );
            }
        },


        // =========================================================
        // PRODUCT SELECTION
        // =========================================================

        onProductSelectionChange: function (oEvent) {

            this.oSelectedProduct =
                oEvent.getParameter("listItem");
        },


        // =========================================================
        // SALE SELECTION
        // =========================================================

        onSaleSelectionChange: function (oEvent) {

    this.oSelectedSale = oEvent.getParameter("listItem");

    const bSelected = !!this.oSelectedSale;

    this.byId("newSaleButton").setEnabled(bSelected);
    this.byId("completeSaleButton").setEnabled(bSelected);
    this.byId("cancelSaleButton").setEnabled(bSelected);
    this.byId("refreshSalesButton").setEnabled(bSelected);
},


        // =========================================================
        // PRODUCT STOCK STATUS
        // =========================================================

        getProductStockStatus: function (iStockQty) {

            const iStock =
                Number(iStockQty);

            if (Number.isNaN(iStock)) {
                return "Available";
            }

            if (iStock < 0) {
                return "Out of Stock";
            }

            return "Available";
        },


        // =========================================================
        // PRODUCT STOCK STATE
        // =========================================================

        getProductStockState: function (iStockQty) {

            const iStock =
                Number(iStockQty);

            if (Number.isNaN(iStock)) {
                return "Success";
            }

            if (iStock < 0) {
                return "Error";
            }

            return "Success";
        },


        // =========================================================
        // NEW SALE
        // =========================================================

        onNewSale: async function () {

            try {

                let aCustomers =
                    this.oLocalModel.getProperty(
                        "/customers"
                    ) || [];

                let aProducts =
                    this.oLocalModel.getProperty(
                        "/products"
                    ) || [];


                if (aCustomers.length === 0) {

                    await this._loadCustomers();

                    aCustomers =
                        this.oLocalModel.getProperty(
                            "/customers"
                        ) || [];
                }


                if (aProducts.length === 0) {

                    await this._loadProducts();

                    aProducts =
                        this.oLocalModel.getProperty(
                            "/products"
                        ) || [];
                }


                if (aCustomers.length === 0) {

                    MessageBox.warning(
                        "No customers available."
                    );

                    return;
                }


                if (aProducts.length === 0) {

                    MessageBox.warning(
                        "No products available."
                    );

                    return;
                }


                // -------------------------------------------------
                // CUSTOMER SELECT
                // -------------------------------------------------

                const oCustomerSelect =
                    new Select({
                        width: "100%"
                    });


                aCustomers.forEach(
                    function (oCustomer) {

                        oCustomerSelect.addItem(
                            new Item({
                                key: oCustomer.ID,
                                text:
                                    oCustomer.customerName
                            })
                        );

                    }
                );


                // -------------------------------------------------
                // PRODUCT SELECT
                // -------------------------------------------------

                const oProductSelect =
                    new Select({
                        width: "100%"
                    });


                aProducts.forEach(
                    function (oProduct) {

                        const iStock =
                            Number(
                                oProduct.stockQty || 0
                            );

                        oProductSelect.addItem(
                            new Item({
                                key: oProduct.ID,
                                text:
                                    oProduct.productName +
                                    " - ₹" +
                                    Number(
                                        oProduct.unitPrice || 0
                                    ).toFixed(2) +
                                    " - Stock: " +
                                    iStock
                            })
                        );

                    }
                );


                // -------------------------------------------------
                // QUANTITY
                // -------------------------------------------------

                const oQuantityInput =
                    new Input({
                        type: "Number",
                        value: "1",
                        width: "100%",
                        placeholder:
                            "Enter quantity"
                    });


                // -------------------------------------------------
                // DIALOG
                // -------------------------------------------------

                const oDialog =
                    new Dialog({

                        title:
                            "New Sale",

                        contentWidth:
                            "30rem",

                        content:
                            new VBox({

                                items: [

                                    new Label({
                                        text:
                                            "Customer",
                                        required:
                                            true
                                    }).addStyleClass(
                                        "sapUiTinyMarginBottom"
                                    ),

                                    oCustomerSelect,


                                    new Label({
                                        text:
                                            "Product",
                                        required:
                                            true
                                    }).addStyleClass(
                                        "sapUiSmallMarginTop"
                                    ),

                                    oProductSelect,


                                    new Label({
                                        text:
                                            "Quantity",
                                        required:
                                            true
                                    }).addStyleClass(
                                        "sapUiSmallMarginTop"
                                    ),

                                    oQuantityInput

                                ]

                            }).addStyleClass(
                                "sapUiSmallMargin"
                            ),


                        // -------------------------------------------------
                        // CREATE SALE BUTTON
                        // -------------------------------------------------

                        beginButton:
                            new Button({

                                text:
                                    "Create Sale",

                                type:
                                    "Emphasized",

                                press:
                                    async function () {

                                        const sCustomerID =
                                            oCustomerSelect
                                                .getSelectedKey();

                                        const sProductID =
                                            oProductSelect
                                                .getSelectedKey();

                                        const iQuantity =
                                            parseInt(
                                                oQuantityInput
                                                    .getValue(),
                                                10
                                            );


                                        if (!sCustomerID) {

                                            MessageBox.warning(
                                                "Please select a customer."
                                            );

                                            return;
                                        }


                                        if (!sProductID) {

                                            MessageBox.warning(
                                                "Please select a product."
                                            );

                                            return;
                                        }


                                        if (
                                            !Number.isInteger(
                                                iQuantity
                                            ) ||
                                            iQuantity <= 0
                                        ) {

                                            MessageBox.warning(
                                                "Quantity must be greater than zero."
                                            );

                                            return;
                                        }


                                        const oProduct =
                                            aProducts.find(
                                                function (oItem) {

                                                    return (
                                                        oItem.ID ===
                                                        sProductID
                                                    );

                                                }
                                            );


                                        if (!oProduct) {

                                            MessageBox.error(
                                                "Selected product was not found."
                                            );

                                            return;
                                        }


                                        const iProductStock =
                                            Number(
                                                oProduct.stockQty || 0
                                            );


                                        if (
                                            iProductStock <
                                            iQuantity
                                        ) {

                                            MessageBox.warning(
                                                "Insufficient stock.\n\n" +
                                                "Available stock: " +
                                                iProductStock +
                                                "\nRequested quantity: " +
                                                iQuantity
                                            );

                                            return;
                                        }


                                        try {

                                            await this._createSale({

                                                customerID:
                                                    sCustomerID,

                                                productID:
                                                    sProductID,

                                                quantity:
                                                    iQuantity

                                            });


                                            oDialog.close();

                                        } catch (error) {

                                            console.error(
                                                "Create sale error:",
                                                error
                                            );

                                            MessageBox.error(
                                                this._getErrorMessage(
                                                    error
                                                )
                                            );
                                        }

                                    }.bind(this)

                            }),


                        // -------------------------------------------------
                        // CANCEL BUTTON
                        // -------------------------------------------------

                        endButton:
                            new Button({

                                text:
                                    "Cancel",

                                press:
                                    function () {

                                        oDialog.close();

                                    }

                            }),


                        afterClose:
                            function () {

                                oDialog.destroy();

                            }

                    });


                this.getView()
                    .addDependent(
                        oDialog
                    );

                oDialog.open();


            } catch (error) {

                console.error(
                    "New Sale error:",
                    error
                );

                MessageBox.error(
                    this._getErrorMessage(
                        error
                    )
                );
            }
        },


        // =========================================================
        // CREATE SALE
        // =========================================================

        _createSale: async function (
            oSaleData
        ) {

            /*
             * IMPORTANT:
             *
             * Do NOT send:
             *     saleNumber
             *     status
             *     unitPrice
             *     totalAmount
             *     saleDate
             *
             * Backend service.js handles these values.
             *
             * Backend will create:
             *     saleNumber = SO000XX
             *     status = Pending
             *     unitPrice = Product.unitPrice
             *     totalAmount = quantity * unitPrice
             *     saleDate = current date/time
             */

            const response =
                await fetch(
                    "/odata/v4/sales-inventory/Sales",
                    {
                        method: "POST",

                        headers: {

                            "Content-Type":
                                "application/json",

                            "Accept":
                                "application/json"
                        },

                        body:
                            JSON.stringify({

                                customer_ID:
                                    oSaleData.customerID,

                                product_ID:
                                    oSaleData.productID,

                                quantity:
                                    oSaleData.quantity

                            })
                    }
                );


            if (!response.ok) {

                let sErrorMessage =
                    "Unable to create sale.";


                try {

                    const oError =
                        await response.json();


                    if (
                        oError &&
                        oError.error &&
                        oError.error.message
                    ) {

                        sErrorMessage =
                            oError.error.message;
                    }

                } catch (e) {

                    // Ignore JSON parsing error
                }


                throw new Error(
                    sErrorMessage
                );
            }


            const oCreatedSale =
                await response.json();


            /*
             * Reload Sales.
             *
             * _loadSales() uses:
             *
             * $orderby=saleDate asc
             *
             * Therefore the newly created sale
             * will appear at the bottom.
             */

            await this._loadSales();


            /*
             * Product stock is not decreased when
             * creating a Pending sale.
             *
             * Stock decreases only when Complete
             * Sale is executed.
             */

            await this._loadProducts();


            MessageToast.show(
                "Sale created successfully. Status: Pending."
            );


            return oCreatedSale;
        },


        // =========================================================
        // COMPLETE SALE
        // =========================================================

        onCompleteSale: async function () {

            const oItem =
                this.oSelectedSale ||
                this.byId("salesTable")
                    .getSelectedItem();


            if (!oItem) {

                MessageToast.show(
                    "Please select a sale first."
                );

                return;
            }


            const sID =
                oItem
                    .getBindingContext("local")
                    .getProperty("ID");


            try {

                await this._callAction(
                    "completeSale",
                    {
                        ID: sID
                    }
                );


                MessageToast.show(
                    "Sale completed successfully."
                );


                /*
                 * Reload Sales so status changes
                 * from Pending to Completed.
                 */

                await this._loadSales();


                /*
                 * Complete Sale decreases inventory
                 * and synchronizes Product stock.
                 */

                await this._loadProducts();


                this._clearSaleSelection();


            } catch (error) {

                MessageBox.error(
                    this._getErrorMessage(error)
                );
            }
        },


        // =========================================================
        // CANCEL SALE
        // =========================================================

        onCancelSale: async function () {

            const oItem =
                this.oSelectedSale ||
                this.byId("salesTable")
                    .getSelectedItem();


            if (!oItem) {

                MessageToast.show(
                    "Please select a sale first."
                );

                return;
            }


            const sID =
                oItem
                    .getBindingContext("local")
                    .getProperty("ID");


            try {

                await this._callAction(
                    "cancelSale",
                    {
                        ID: sID
                    }
                );


                MessageToast.show(
                    "Sale cancelled successfully."
                );


                await this._loadSales();

                this._clearSaleSelection();


            } catch (error) {

                MessageBox.error(
                    this._getErrorMessage(error)
                );
            }
        },


        // =========================================================
        // GENERIC ACTION
        // =========================================================

        _callAction: async function (
            sAction,
            oPayload
        ) {

            const response =
                await fetch(
                    "/odata/v4/sales-inventory/" +
                    sAction,
                    {
                        method: "POST",

                        headers: {

                            "Content-Type":
                                "application/json",

                            "Accept":
                                "application/json"
                        },

                        body:
                            JSON.stringify(
                                oPayload
                            )
                    }
                );


            if (!response.ok) {

                let errorMessage =
                    "Action failed: " +
                    response.status;


                try {

                    const errorData =
                        await response.json();


                    if (
                        errorData &&
                        errorData.error &&
                        errorData.error.message
                    ) {

                        errorMessage =
                            errorData.error.message;
                    }

                } catch (e) {

                    // Ignore JSON parsing error
                }


                throw new Error(
                    errorMessage
                );
            }


            const text =
                await response.text();


            if (!text) {
                return null;
            }


            try {

                return JSON.parse(text);

            } catch (e) {

                return text;
            }
        },


        // =========================================================
        // GET PRODUCT NAME
        // =========================================================

        getProductName: function (
            sProductId
        ) {

            if (!sProductId) {
                return "";
            }


            const aProducts =
                (
                    this.oLocalModel &&
                    this.oLocalModel.getProperty(
                        "/products"
                    )
                ) || [];


            /*
             * Convert the incoming Inventory product ID
             * to String so that comparison works even
             * if OData returns the value differently.
             */

            const sId =
                String(sProductId);


            const oProduct =
                aProducts.find(
                    function (oP) {

                        if (!oP) {
                            return false;
                        }


                        /*
                         * Normal Product ID
                         */

                        if (
                            oP.ID !== undefined &&
                            oP.ID !== null &&
                            String(oP.ID) === sId
                        ) {

                            return true;
                        }


                        /*
                         * Compatibility if product_ID
                         * is present in Product data.
                         */

                        if (
                            oP.product_ID !== undefined &&
                            oP.product_ID !== null &&
                            String(oP.product_ID) === sId
                        ) {

                            return true;
                        }


                        /*
                         * Compatibility for lower-case id.
                         */

                        if (
                            oP.id !== undefined &&
                            oP.id !== null &&
                            String(oP.id) === sId
                        ) {

                            return true;
                        }


                        return false;
                    }
                );


            /*
             * Return Product Name.
             *
             * Do not display UUID / Product ID when
             * product cannot be found.
             */

            return oProduct &&
                oProduct.productName
                ? oProduct.productName
                : "";
        },


        // =========================================================
        // GET INVENTORY MODEL
        // =========================================================

        _getInventoryModel: function () {

            return this.getView()
                .getModel("inventory");
        },


        // =========================================================
        // SHOW ERROR
        // =========================================================

        _showError: function (
            oError
        ) {

            MessageBox.error(
                this._getErrorMessage(
                    oError
                )
            );
        },


        // =========================================================
        // INVENTORY ACTION
        // =========================================================

        _callInventoryAction: async function (
            sActionName,
            mParams
        ) {

            const oModel =
                this._getInventoryModel();


            if (!oModel) {

                const oError =
                    new Error(
                        "Inventory OData model is not available. " +
                        "Please check manifest.json."
                    );


                this._showError(
                    oError
                );


                throw oError;
            }


            try {

                const oAction =
                    oModel.bindContext(
                        "/" +
                        sActionName +
                        "(...)"
                    );


                Object.keys(
                    mParams || {}
                ).forEach(
                    function (sKey) {

                        oAction.setParameter(
                            sKey,
                            mParams[sKey]
                        );

                    }
                );


                const result =
                    await oAction.execute();


                const oTable =
                    this.byId(
                        "inventoryTable"
                    );


                const oBinding =
                    oTable &&
                    oTable.getBinding(
                        "items"
                    );


                if (oBinding) {

                    oBinding.refresh();
                }


                /*
                 * Inventory stock changes are reflected
                 * in Products.stockQty.
                 */

                await this._loadProducts();


                MessageToast.show(
                    sActionName +
                    " successful"
                );


                return result;


            } catch (oError) {

                console.error(
                    "Inventory action error:",
                    oError
                );


                this._showError(
                    oError
                );


                throw oError;
            }
        },


        // =========================================================
        // REFRESH INVENTORY
        // =========================================================

        onRefreshInventory: function () {

            const oTable =
                this.byId(
                    "inventoryTable"
                );


            if (!oTable) {

                MessageBox.error(
                    "Inventory table not found."
                );

                return;
            }


            const oBinding =
                oTable.getBinding(
                    "items"
                );


            if (!oBinding) {

                MessageBox.warning(
                    "Inventory binding is not available."
                );

                return;
            }


            oBinding.refresh();


            /*
             * Product stock mirrors Inventory stock.
             */

            this._loadProducts();


            MessageToast.show(
                "Inventory refreshed successfully."
            );
        },


        // =========================================================
        // GET INVENTORY ROW CONTEXT
        // =========================================================

        _getRowContext: function (
            oEvent
        ) {

            let oControl =
                oEvent.getSource();


            while (oControl) {

                const oContext =
                    oControl.getBindingContext(
                        "inventory"
                    );


                if (oContext) {
                    return oContext;
                }


                oControl =
                    oControl.getParent();
            }


            return null;
        },


        // =========================================================
        // QUANTITY DIALOG
        // =========================================================

        _openQtyDialog: function (
            sTitle,
            sActionName,
            sInventoryID
        ) {

            if (!sInventoryID) {

                MessageBox.error(
                    "Inventory ID is missing. Cannot proceed."
                );

                return;
            }


            const oInput =
                new Input({
                    type: "Number",
                    placeholder:
                        "Enter quantity",
                    width: "100%"
                });


            const oDialog =
                new Dialog({

                    title:
                        sTitle,

                    contentWidth:
                        "20rem",


                    content:
                        new VBox({

                            items: [

                                new Label({
                                    text:
                                        "Quantity"
                                }),

                                oInput

                            ]

                        }).addStyleClass(
                            "sapUiSmallMargin"
                        ),


                    beginButton:
                        new Button({

                            text:
                                "Submit",

                            type:
                                "Emphasized",


                            press:
                                async () => {

                                    const iQuantity =
                                        parseInt(
                                            oInput.getValue(),
                                            10
                                        );


                                    if (
                                        !Number.isInteger(
                                            iQuantity
                                        ) ||
                                        iQuantity <= 0
                                    ) {

                                        MessageBox.warning(
                                            "Please enter a valid quantity greater than zero."
                                        );

                                        return;
                                    }


                                    try {

                                        await this
                                            ._callInventoryAction(
                                                sActionName,
                                                {
                                                    inventoryID:
                                                        sInventoryID,

                                                    quantity:
                                                        iQuantity
                                                }
                                            );


                                        oDialog.close();


                                    } catch (error) {

                                        /*
                                         * Error already shown
                                         * by _callInventoryAction.
                                         */

                                    }
                                }

                        }),


                    endButton:
                        new Button({

                            text:
                                "Cancel",

                            press:
                                function () {

                                    oDialog.close();

                                }

                        }),


                    afterClose:
                        function () {

                            oDialog.destroy();

                        }

                });


            this.getView()
                .addDependent(
                    oDialog
                );


            oDialog.open();
        },


        // =========================================================
        // ADJUST STOCK
        // =========================================================

        onAdjustStock: function (
            oEvent
        ) {

            const oContext =
                this._getRowContext(
                    oEvent
                );


            if (!oContext) {

                MessageBox.error(
                    "Could not find the selected inventory row."
                );

                return;
            }


            this._openQtyDialog(
                "Adjust Stock",
                "adjustStock",
                oContext.getProperty(
                    "ID"
                )
            );
        },


        // =========================================================
        // RESERVE STOCK
        // =========================================================

        onReserveStock: function (
            oEvent
        ) {

            const oContext =
                this._getRowContext(
                    oEvent
                );


            if (!oContext) {

                MessageBox.error(
                    "Could not find the selected inventory row."
                );

                return;
            }


            this._openQtyDialog(
                "Reserve Stock",
                "reserveStock",
                oContext.getProperty(
                    "ID"
                )
            );
        },


        // =========================================================
        // RELEASE STOCK
        // =========================================================

        onReleaseStock: function (
            oEvent
        ) {

            const oContext =
                this._getRowContext(
                    oEvent
                );


            if (!oContext) {

                MessageBox.error(
                    "Could not find the selected inventory row."
                );

                return;
            }


            this._openQtyDialog(
                "Release Stock",
                "releaseStock",
                oContext.getProperty(
                    "ID"
                )
            );
        },


        // =========================================================
        // CLEAR PRODUCT SELECTION
        // =========================================================

        _clearProductSelection: function () {

            this.oSelectedProduct =
                null;


            const oTable =
                this.byId(
                    "productsTable"
                );


            if (oTable) {

                oTable.removeSelections(
                    true
                );
            }
        },


        // =========================================================
        // CLEAR SALE SELECTION
        // =========================================================

        _clearSaleSelection: function () {

            this.oSelectedSale =
                null;


            const oTable =
                this.byId(
                    "salesTable"
                );


            if (oTable) {

                oTable.removeSelections(
                    true
                );
            }
        },


        // =========================================================
        // ERROR MESSAGE
        // =========================================================

        _getErrorMessage: function (
            error
        ) {

            if (!error) {

                return "Unknown error occurred.";
            }


            if (error.message) {

                return error.message;
            }


            if (
                error.error &&
                error.error.message
            ) {

                return error.error.message;
            }


            return String(error);
        }

    });
});