sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Input",
    "sap/m/Label",
    "sap/m/VBox",
    "sap/m/HBox",
    "sap/m/Select",
    "sap/m/Text",
    "sap/ui/core/Item",
    "../model/formatter"
], function (
    Controller,
    JSONModel,
    Filter,
    FilterOperator,
    MessageToast,
    MessageBox,
    Dialog,
    Button,
    Input,
    Label,
    VBox,
    HBox,
    Select,
    Text,
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
                currentPage: "dashboard",
                products: [],
                sales: [],
                customers: [],
                analytics: {
                    totalRevenue: 0,
                    totalSalesCount: 0,
                    avgSaleValue: 0,
                    completionRate: 0,
                    salesTrend: [],
                    categoryBreakdown: [],
                    topProducts: []
                }
            });

            this.getView().setModel(
                this.oLocalModel,
                "local"
            );

            this.oSelectedProduct = null;
            this.oSelectedSale = null;

            Promise.all([
                this._loadProducts(),
                this._loadSales(),
                this._loadCustomers()
            ]).then(() => {
                this._computeAnalytics();
            });

            if (!this.getView().getModel("inventory")) {
                console.error(
                    "Inventory OData model is not available. Check manifest.json."
                );
            }
        },


        // =========================================================
        // NAVIGATION
        // =========================================================

        onSideNavToggle: function () {

            const oToolPage = this.byId("toolPage");

            oToolPage.setSideExpanded(
                !oToolPage.getSideExpanded()
            );
        },


        onSideNavItemSelect: function (oEvent) {

            const sKey =
                oEvent.getParameter("item").getKey();

            if (sKey) {
                this.oLocalModel.setProperty(
                    "/currentPage",
                    sKey
                );
            }
        },


        onTabSelect: function (oEvent) {

            const sKey =
                oEvent.getParameter("selectedKey") ||
                oEvent.getParameter("key");

            if (sKey) {
                this.oLocalModel.setProperty(
                    "/currentPage",
                    sKey
                );
            }
        },


        onViewAllSales: function () {

            this.oLocalModel.setProperty(
                "/currentPage",
                "sales"
            );
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

                const data =
                    await response.json();

                this.oLocalModel.setProperty(
                    "/products",
                    data.value || []
                );

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
                const response = await fetch(
                    "/odata/v4/sales-inventory/Sales?$expand=customer,product($expand=category)&$orderby=saleDate asc"
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

                const data =
                    await response.json();

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

            this.oSelectedSale =
                oEvent.getParameter("listItem");

            const bSelected =
                !!this.oSelectedSale;

            this.byId("completeSaleButton")
                .setEnabled(bSelected);

            this.byId("cancelSaleButton")
                .setEnabled(bSelected);
        },


        // =========================================================
        // SALES SEARCH
        // =========================================================

        onSalesSearch: function (oEvent) {

            const sQuery =
                (
                    oEvent.getParameter("newValue") ||
                    oEvent.getParameter("query") ||
                    ""
                ).trim();

            this._applySalesFilters(sQuery);
        },


        // =========================================================
        // SALES STATUS FILTER
        // =========================================================

        onSalesStatusFilterChange: function () {

            const oSearchField =
                this.byId("salesSearchField");

            const sQuery =
                oSearchField
                    ? (
                        oSearchField.getValue() ||
                        ""
                    ).trim()
                    : "";

            this._applySalesFilters(sQuery);
        },


        _applySalesFilters: function (sQuery) {

            const oTable =
                this.byId("salesTable");

            if (!oTable) {
                return;
            }

            const oBinding =
                oTable.getBinding("items");

            if (!oBinding) {
                return;
            }

            const oSelect =
                this.byId("salesStatusFilter");

            const sStatus =
                oSelect
                    ? oSelect.getSelectedKey()
                    : "";

            const aFilters = [];


            // Search filter
            if (sQuery) {

                aFilters.push(
                    new Filter({
                        filters: [

                            new Filter(
                                "saleNumber",
                                FilterOperator.Contains,
                                sQuery
                            ),

                            new Filter(
                                "customer/customerName",
                                FilterOperator.Contains,
                                sQuery
                            ),

                            new Filter(
                                "product/productName",
                                FilterOperator.Contains,
                                sQuery
                            )

                        ],
                        and: false
                    })
                );
            }


            // Status filter
            if (sStatus) {

                aFilters.push(
                    new Filter(
                        "status",
                        FilterOperator.EQ,
                        sStatus
                    )
                );
            }


            oBinding.filter(aFilters);
        },


        // =========================================================
        // NEW SALE
        // ONE OR MORE PRODUCTS
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


                // =================================================
                // CUSTOMER SELECT
                // =================================================

                const oCustomerSelect =
                    new Select({
                        width: "100%",
                        forceSelection: true
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


                // =================================================
                // PRODUCT CONTAINER
                // =================================================

                const oProductContainer =
                    new VBox({
                        width: "100%"
                    });


                // =================================================
                // CREATE PRODUCT ROW
                // =================================================

                const fnCreateProductRow =
                    function () {

                        // -------------------------------
                        // PRODUCT SELECT
                        // -------------------------------

                        const oProductSelect =
                            new Select({

                                width: "100%",

                                forceSelection: true
                            });


                        aProducts.forEach(
                            function (oProduct) {

                                const iStock =
                                    Number(
                                        oProduct.stockQty ||
                                        0
                                    );

                                oProductSelect.addItem(
                                    new Item({

                                        key:
                                            oProduct.ID,

                                        text:
                                            oProduct.productName +
                                            " - ₹" +
                                            Number(
                                                oProduct.unitPrice ||
                                                0
                                            ).toFixed(2) +
                                            " - Stock: " +
                                            iStock

                                    })
                                );
                            }
                        );


                        // -------------------------------
                        // QUANTITY INPUT
                        // -------------------------------

                        const oQuantityInput =
                            new Input({

                                type: "Number",

                                value: "1",

                                width: "7rem",

                                textAlign: "Center",

                                placeholder: "Quantity"
                            });


                        // -------------------------------
                        // REMOVE BUTTON
                        // -------------------------------

                        const oRemoveButton =
                            new Button({

                                icon:
                                    "sap-icon://delete",

                                type:
                                    "Transparent",

                                tooltip:
                                    "Remove product",

                                width:
                                    "3rem"

                            });


                        // =================================================
                        // PRODUCT CARD
                        // =================================================

                        const oProductRow =
                            new VBox({

                                width: "100%",

                                items: [

                                    // Product label
                                    new Label({
                                        text:
                                            "Product",
                                        required:
                                            true
                                    }).addStyleClass(
                                        "sapUiTinyMarginBottom"
                                    ),

                                    // Product select
                                    oProductSelect,

                                    // Quantity section
                                    new HBox({

                                        width:
                                            "100%",

                                        alignItems:
                                            "Center",

                                        items: [

                                            new Label({

                                                text:
                                                    "Quantity",

                                                width:
                                                    "6rem"

                                            }).addStyleClass(
                                                "sapUiSmallMarginTop"
                                            ),

                                            oQuantityInput
                                                .addStyleClass(
                                                    "sapUiSmallMarginBegin sapUiSmallMarginTop"
                                                ),

                                            oRemoveButton
                                                .addStyleClass(
                                                    "sapUiSmallMarginBegin sapUiSmallMarginTop"
                                                )

                                        ]

                                    })

                                ]

                            }).addStyleClass(
                                "sapUiSmallMarginBottom sapUiSmallPadding"
                            );


                        // =================================================
                        // BORDER / BACKGROUND STYLE
                        // =================================================

                        oProductRow.addStyleClass(
                            "saleProductRow"
                        );


                        // =================================================
                        // REMOVE PRODUCT
                        // =================================================

                        oRemoveButton.attachPress(
                            function () {

                                const aItems =
                                    oProductContainer
                                        .getItems();


                                if (
                                    aItems.length <= 1
                                ) {

                                    MessageToast.show(
                                        "At least one product is required."
                                    );

                                    return;
                                }


                                oProductContainer
                                    .removeItem(
                                        oProductRow
                                    );

                                oProductRow.destroy();
                            }
                        );


                        // Store controls
                        oProductRow.data(
                            "productSelect",
                            oProductSelect
                        );

                        oProductRow.data(
                            "quantityInput",
                            oQuantityInput
                        );


                        oProductContainer.addItem(
                            oProductRow
                        );


                        return oProductRow;
                    };


                // First product
                fnCreateProductRow();


                // =================================================
                // ADD PRODUCT BUTTON
                // =================================================

                const oAddProductButton =
                    new Button({

                        text:
                            "Add Product",

                        icon:
                            "sap-icon://add",

                        type:
                            "Transparent",

                        press:
                            function () {

                                fnCreateProductRow();
                            }

                    }).addStyleClass(
                        "sapUiSmallMarginTop"
                    );


                // =================================================
                // DIALOG
                // =================================================

                const oDialog =
                    new Dialog({

                        title:
                            "New Sale",

                        contentWidth:
                            "42rem",

                        content:

                            new VBox({

                                width:
                                    "100%",

                                items: [

                                    // Customer
                                    new Label({

                                        text:
                                            "Customer",

                                        required:
                                            true

                                    }).addStyleClass(
                                        "sapUiSmallMarginBottom"
                                    ),


                                    oCustomerSelect,


                                    // Products heading
                                    new Label({

                                        text:
                                            "Products",

                                        required:
                                            true

                                    }).addStyleClass(
                                        "sapUiMediumMarginTop sapUiSmallMarginBottom"
                                    ),


                                    // Products
                                    oProductContainer,


                                    // Add Product
                                    oAddProductButton

                                ]

                            }).addStyleClass(
                                "sapUiMediumMargin"
                            ),


                        // =================================================
                        // CREATE SALE
                        // =================================================

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


                                        if (!sCustomerID) {

                                            MessageBox.warning(
                                                "Please select a customer."
                                            );

                                            return;
                                        }


                                        const aRows =
                                            oProductContainer
                                                .getItems();


                                        if (
                                            !aRows ||
                                            aRows.length === 0
                                        ) {

                                            MessageBox.warning(
                                                "Please add at least one product."
                                            );

                                            return;
                                        }


                                        const aSaleProducts =
                                            [];

                                        const oProductMap =
                                            {};


                                        // =====================================
                                        // VALIDATE ALL PRODUCT ROWS
                                        // =====================================

                                        for (
                                            let i = 0;
                                            i < aRows.length;
                                            i++
                                        ) {

                                            const oRow =
                                                aRows[i];


                                            const oProductSelect =
                                                oRow.data(
                                                    "productSelect"
                                                );


                                            const oQuantityInput =
                                                oRow.data(
                                                    "quantityInput"
                                                );


                                            const sProductID =
                                                oProductSelect
                                                    .getSelectedKey();


                                            const iQuantity =
                                                parseInt(
                                                    oQuantityInput
                                                        .getValue(),
                                                    10
                                                );


                                            if (!sProductID) {

                                                MessageBox.warning(
                                                    "Please select a product in row " +
                                                    (i + 1) +
                                                    "."
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
                                                    "Quantity must be greater than zero in row " +
                                                    (i + 1) +
                                                    "."
                                                );

                                                return;
                                            }


                                            // Prevent duplicate product
                                            if (
                                                Object.prototype
                                                    .hasOwnProperty
                                                    .call(
                                                        oProductMap,
                                                        sProductID
                                                    )
                                            ) {

                                                MessageBox.warning(
                                                    "The same product cannot be added more than once."
                                                );

                                                return;
                                            }


                                            const oProduct =
                                                aProducts.find(
                                                    function (
                                                        oItem
                                                    ) {

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
                                                    oProduct.stockQty ||
                                                    0
                                                );


                                            if (
                                                iProductStock <
                                                iQuantity
                                            ) {

                                                MessageBox.warning(

                                                    "Insufficient stock for " +
                                                    oProduct.productName +
                                                    ".\n\n" +

                                                    "Available stock: " +
                                                    iProductStock +

                                                    "\nRequested quantity: " +
                                                    iQuantity
                                                );

                                                return;
                                            }


                                            oProductMap[
                                                sProductID
                                            ] = true;


                                            aSaleProducts.push({

                                                productID:
                                                    sProductID,

                                                quantity:
                                                    iQuantity
                                            });
                                        }


                                        // =====================================
                                        // CREATE ALL SALES
                                        // =====================================

                                        try {

                                            for (
                                                let i = 0;
                                                i <
                                                aSaleProducts.length;
                                                i++
                                            ) {

                                                await this._createSale({

                                                    customerID:
                                                        sCustomerID,

                                                    productID:
                                                        aSaleProducts[i]
                                                            .productID,

                                                    quantity:
                                                        aSaleProducts[i]
                                                            .quantity

                                                });
                                            }


                                            // Reload only once
                                            await this._loadSales();

                                            await this._loadProducts();

                                            this._computeAnalytics();


                                            oDialog.close();


                                            MessageToast.show(
                                                aSaleProducts.length +
                                                " product sale item(s) created successfully. Status: Pending."
                                            );

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


                        // =================================================
                        // CANCEL
                        // =================================================

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


                this.getView().addDependent(
                    oDialog
                );

                oDialog.open();


            } catch (error) {

                console.error(
                    "New Sale error:",
                    error
                );

                MessageBox.error(
                    this._getErrorMessage(error)
                );
            }
        },


        // =========================================================
        // CREATE SALE
        // =========================================================

        _createSale: async function (
            oSaleData
        ) {

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
                    // Ignore
                }

                throw new Error(
                    sErrorMessage
                );
            }


            return await response.json();
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


                await this._loadSales();

                await this._loadProducts();

                this._computeAnalytics();

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

                this._computeAnalytics();

                this._clearSaleSelection();

            } catch (error) {

                MessageBox.error(
                    this._getErrorMessage(error)
                );
            }
        },


        // =========================================================
        // REFRESH
        // =========================================================

        onRefresh: async function () {

            try {

                await Promise.all([
                    this._loadProducts(),
                    this._loadSales()
                ]);

                this._computeAnalytics();

                this._clearProductSelection();

                this._clearSaleSelection();

                MessageToast.show(
                    "Products and Sales refreshed successfully."
                );

            } catch (error) {

                console.error(error);
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
                    // Ignore
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
        // PRODUCT NAME
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


            const sId =
                String(sProductId);


            const oProduct =
                aProducts.find(
                    function (oP) {

                        if (!oP) {
                            return false;
                        }


                        if (
                            oP.ID !== undefined &&
                            oP.ID !== null &&
                            String(oP.ID) === sId
                        ) {
                            return true;
                        }


                        if (
                            oP.product_ID !== undefined &&
                            oP.product_ID !== null &&
                            String(oP.product_ID) === sId
                        ) {
                            return true;
                        }


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


            return (
                oProduct &&
                oProduct.productName
            )
                ? oProduct.productName
                : "";
        },


        // =========================================================
        // ANALYTICS
        // =========================================================

        _computeAnalytics: function () {

            const aSales =
                this.oLocalModel.getProperty(
                    "/sales"
                ) || [];


            if (aSales.length === 0) {

                this.oLocalModel.setProperty(
                    "/analytics",
                    {
                        totalRevenue: 0,
                        totalSalesCount: 0,
                        avgSaleValue: 0,
                        completionRate: 0,
                        salesTrend: [],
                        categoryBreakdown: [],
                        topProducts: []
                    }
                );

                return;
            }


            const totalRevenue =
                aSales.reduce(
                    function (
                        sum,
                        s
                    ) {

                        return (
                            sum +
                            (
                                Number(
                                    s.totalAmount
                                ) || 0
                            )
                        );
                    },
                    0
                );


            const totalSalesCount =
                aSales.length;


            const avgSaleValue =
                totalSalesCount > 0
                    ? totalRevenue /
                    totalSalesCount
                    : 0;


            const completedCount =
                aSales.filter(
                    function (s) {

                        return (
                            s.status ===
                            "Completed"
                        );
                    }
                ).length;


            const completionRate =
                totalSalesCount > 0
                    ? (
                        completedCount /
                        totalSalesCount
                    ) * 100
                    : 0;


            const oTrendMap = {};


            aSales.forEach(
                function (s) {

                    const sDate =
                        s.saleDate
                            ? String(
                                s.saleDate
                            ).split("T")[0]
                            : "Unknown";


                    oTrendMap[sDate] =
                        (
                            oTrendMap[sDate] ||
                            0
                        ) +
                        (
                            Number(
                                s.totalAmount
                            ) || 0
                        );
                }
            );


            const salesTrend =
                Object.keys(
                    oTrendMap
                )
                    .sort()
                    .map(
                        function (sDate) {

                            return {

                                label:
                                    sDate,

                                value:
                                    Math.round(
                                        oTrendMap[
                                        sDate
                                        ]
                                    )
                            };
                        }
                    );


            const oCategoryMap = {};


            aSales.forEach(
                function (s) {

                    const sCategory =
                        (
                            s.product &&
                            s.product.category &&
                            s.product.category
                                .categoryName
                        )
                            ?
                            s.product.category
                                .categoryName
                            :
                            "Uncategorized";


                    oCategoryMap[
                        sCategory
                    ] =
                        (
                            oCategoryMap[
                            sCategory
                            ] || 0
                        ) +
                        (
                            Number(
                                s.totalAmount
                            ) || 0
                        );
                }
            );


            const categoryBreakdown =
                Object.keys(
                    oCategoryMap
                )
                    .map(
                        function (
                            sCategory
                        ) {

                            return {

                                category:
                                    sCategory,

                                percent:
                                    totalRevenue > 0
                                        ?
                                        Math.round(
                                            (
                                                oCategoryMap[
                                                sCategory
                                                ] /
                                                totalRevenue
                                            ) * 100
                                        )
                                        :
                                        0
                            };
                        }
                    )
                    .sort(
                        function (
                            a,
                            b
                        ) {

                            return (
                                b.percent -
                                a.percent
                            );
                        }
                    );


            const oProductMap = {};


            aSales.forEach(
                function (s) {

                    const sProductName =
                        (
                            s.product &&
                            s.product.productName
                        )
                            ?
                            s.product.productName
                            :
                            "Unknown";


                    oProductMap[
                        sProductName
                    ] =
                        (
                            oProductMap[
                            sProductName
                            ] || 0
                        ) +
                        (
                            Number(
                                s.totalAmount
                            ) || 0
                        );
                }
            );


            const topProducts =
                Object.keys(
                    oProductMap
                )
                    .map(
                        function (sName) {

                            return {

                                title:
                                    sName,

                                value:
                                    Math.round(
                                        oProductMap[
                                        sName
                                        ]
                                    )
                            };
                        }
                    )
                    .sort(
                        function (
                            a,
                            b
                        ) {

                            return (
                                b.value -
                                a.value
                            );
                        }
                    )
                    .slice(
                        0,
                        5
                    );


            this.oLocalModel.setProperty(
                "/analytics",
                {

                    totalRevenue:
                        Math.round(
                            totalRevenue
                        ),

                    totalSalesCount:
                        totalSalesCount,

                    avgSaleValue:
                        Math.round(
                            avgSaleValue
                        ),

                    completionRate:
                        Math.round(
                            completionRate
                        ),

                    salesTrend:
                        salesTrend,

                    categoryBreakdown:
                        categoryBreakdown,

                    topProducts:
                        topProducts
                }
            );
        },


        onRefreshAnalytics:
            async function () {

                await Promise.all([
                    this._loadSales(),
                    this._loadProducts()
                ]);

                this._computeAnalytics();

                MessageToast.show(
                    "Analytics refreshed successfully."
                );
            },


        // =========================================================
        // INVENTORY
        // =========================================================

        _getInventoryModel: function () {

            return this.getView()
                .getModel("inventory");
        },


        _showError: function (oError) {

            MessageBox.error(
                this._getErrorMessage(oError)
            );
        },


        _callInventoryAction:
            async function (
                sActionName,
                mParams
            ) {

                const oModel =
                    this._getInventoryModel();


                if (!oModel) {

                    const oError =
                        new Error(
                            "Inventory OData model is not available. Please check manifest.json."
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
                        function (
                            sKey
                        ) {

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


                    await this._loadProducts();

                    this._computeAnalytics();

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

            this._loadProducts();

            MessageToast.show(
                "Inventory refreshed successfully."
            );
        },


        _getRowContext: function (oEvent) {

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


        _openQtyDialog:
            function (
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

                        type:
                            "Number",

                        placeholder:
                            "Enter quantity",

                        width:
                            "100%"
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
                                                oInput
                                                    .getValue(),
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

                                            // Error already shown
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
        // CLEAR SELECTIONS
        // =========================================================

        _clearProductSelection: function () {

            this.oSelectedProduct = null;

            const oTable =
                this.byId(
                    "productsTable"
                );


            if (oTable) {
                oTable.removeSelections(true);
            }
        },


        _clearSaleSelection: function () {

            this.oSelectedSale = null;

            const oTable =
                this.byId(
                    "salesTable"
                );


            if (oTable) {
                oTable.removeSelections(true);
            }


            this.byId(
                "completeSaleButton"
            ).setEnabled(false);


            this.byId(
                "cancelSaleButton"
            ).setEnabled(false);
        },


        // =========================================================
        // ERROR
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
        },
        // =========================================================
        // INVENTORY FILTERS (applied only on "Filter" button click)
        // =========================================================

        // Search/Select events are wired in XML but intentionally
        // do nothing here — filtering only happens when the
        // Filter button is pressed (onApplyInventoryFilters)
        onInventoryFilterChange: function () {
            // no-op: filters apply only via the Filter button
        },

        onApplyInventoryFilters: function () {
            this._applyInventoryFilters();
        },

        _applyInventoryFilters: function () {

            var oTable = this.byId("inventoryTable");

            if (!oTable) {
                MessageBox.error("Inventory table not found.");
                return;
            }

            var oBinding = oTable.getBinding("items");

            if (!oBinding) {
                MessageBox.warning("Inventory table binding is not available.");
                return;
            }

            var aFilters = [];

            // -------------------------------------------------
            // Search filter — matches by Product Name
            // (inventory rows only carry product_ID, so we resolve
            // matching product names to their IDs first, then
            // filter inventory by those IDs using EQ)
            // -------------------------------------------------
            var oSearchField = this.byId("inventoryProductSearch");
            var sSearchQuery = oSearchField ? (oSearchField.getValue() || "").trim() : "";

            if (sSearchQuery) {

                var aProducts = this.oLocalModel.getProperty("/products") || [];
                var sQueryLower = sSearchQuery.toLowerCase();

                var aMatchingIds = aProducts
                    .filter(function (oProduct) {
                        return oProduct.productName &&
                            oProduct.productName.toLowerCase().indexOf(sQueryLower) !== -1;
                    })
                    .map(function (oProduct) {
                        return oProduct.ID;
                    });

                if (aMatchingIds.length > 0) {

                    var aIdFilters = aMatchingIds.map(function (sId) {
                        return new Filter("product_ID", FilterOperator.EQ, sId);
                    });

                    aFilters.push(new Filter({ filters: aIdFilters, and: false }));

                } else {

                    // No product matched the search text — force zero results
                    aFilters.push(new Filter("product_ID", FilterOperator.EQ, "__NO_MATCH__"));
                }
            }

            // -------------------------------------------------
            // Warehouse filter
            // -------------------------------------------------
            var oWarehouseSelect = this.byId("inventoryWarehouseFilter");
            var sSelectedWarehouse = oWarehouseSelect ? oWarehouseSelect.getSelectedKey() : "";

            if (sSelectedWarehouse && sSelectedWarehouse !== "All Warehouses") {
                aFilters.push(
                    new Filter("warehouse/warehouseName", FilterOperator.EQ, sSelectedWarehouse)
                );
            }

            // -------------------------------------------------
            // Stock status filter
            // NOTE: key is "Out Of Stock" (exact case/spacing from XML)
            // -------------------------------------------------
            var oStockFilter = this.byId("inventoryStockStatusFilter");
            var sStockStatus = oStockFilter ? oStockFilter.getSelectedKey() : "";

            if (sStockStatus === "available") {
                aFilters.push(new Filter("stockQty", FilterOperator.GT, 0));
            } else if (sStockStatus === "Out Of Stock") {
                aFilters.push(new Filter("stockQty", FilterOperator.EQ, 0));
            }

            // -------------------------------------------------
            // Set contextual "no data" message BEFORE filtering
            // -------------------------------------------------
            oTable.setNoDataText(
                this._buildInventoryNoDataText(sSelectedWarehouse, sStockStatus, sSearchQuery)
            );

            // Apply all active filters together (AND across categories)
            oBinding.filter(aFilters);

            MessageToast.show("Filters applied.");
        },

        // =========================================================
        // BUILD CONTEXTUAL "NO DATA" MESSAGE
        // =========================================================

        _buildInventoryNoDataText: function (sWarehouse, sStockStatus, sSearchQuery) {

            var bHasWarehouse = sWarehouse && sWarehouse !== "All Warehouses";
            var sWarehouseLabel = "";

            if (bHasWarehouse) {
                var oWarehouseSelect = this.byId("inventoryWarehouseFilter");
                var oSelectedItem = oWarehouseSelect.getSelectedItem();
                sWarehouseLabel = oSelectedItem ? oSelectedItem.getText() : sWarehouse;
            }

            if (sSearchQuery) {
                return "No products matching \"" + sSearchQuery + "\" were found" +
                    (bHasWarehouse ? " in " + sWarehouseLabel : "") + ".";
            }

            if (sStockStatus === "Out Of Stock") {

                return bHasWarehouse
                    ? "There is no out of stock inventory in " + sWarehouseLabel + "."
                    : "There is no out of stock inventory.";

            } else if (sStockStatus === "available") {

                return bHasWarehouse
                    ? "No available stock found in " + sWarehouseLabel + "."
                    : "No available stock found.";
            }

            return bHasWarehouse
                ? "No inventory records available for " + sWarehouseLabel + "."
                : "No inventory records available.";
        },

        // =========================================================
        // CLEAR INVENTORY FILTERS
        // =========================================================

        onClearInventoryFilters: function () {

            var oSearchField = this.byId("inventoryProductSearch");
            var oWarehouseSelect = this.byId("inventoryWarehouseFilter");
            var oStockFilter = this.byId("inventoryStockStatusFilter");
            var oTable = this.byId("inventoryTable");

            if (oSearchField) {
                oSearchField.setValue("");
            }

            if (oWarehouseSelect) {
                oWarehouseSelect.setSelectedKey("All Warehouses");
            }

            if (oStockFilter) {
                oStockFilter.setSelectedKey("");
            }

            if (oTable) {
                oTable.setNoDataText("No inventory records available");

                var oBinding = oTable.getBinding("items");

                if (oBinding) {
                    oBinding.filter([]);
                }
            }

            MessageToast.show("Inventory filters cleared.");
        },
        // =========================================================
        // SALES FILTERS (applied only on "Filter" button click)
        // =========================================================

                // =========================================================
        // SALES FILTERS (applied only on "Filter" button click)
        // =========================================================

        onApplySalesFilters: function () {
            this._applySalesFilters();
        },

        _applySalesFilters: function () {

            var oTable = this.byId("salesTable");

            if (!oTable) {
                MessageBox.error("Sales table not found.");
                return;
            }

            var oBinding = oTable.getBinding("items");

            if (!oBinding) {
                MessageBox.warning("Sales table binding is not available.");
                return;
            }

            var aFilters = [];

            // -------------------------------------------------
            // Search filter (sale number, customer, product)
            // -------------------------------------------------
            var oSearchField = this.byId("salesSearchField");
            var sQuery = oSearchField ? (oSearchField.getValue() || "").trim() : "";

            if (sQuery) {

                var sQueryLower = sQuery.toLowerCase();

                aFilters.push(
                    new Filter({
                        filters: [

                            new Filter({
                                path: "saleNumber",
                                test: function (sVal) {
                                    return sVal && String(sVal).toLowerCase().indexOf(sQueryLower) !== -1;
                                }
                            }),

                            new Filter({
                                path: "customer/customerName",
                                test: function (sVal) {
                                    return sVal && String(sVal).toLowerCase().indexOf(sQueryLower) !== -1;
                                }
                            }),

                            new Filter({
                                path: "product/productName",
                                test: function (sVal) {
                                    return sVal && String(sVal).toLowerCase().indexOf(sQueryLower) !== -1;
                                }
                            })

                        ],
                        and: false
                    })
                );
            }

            // -------------------------------------------------
            // Status filter
            // -------------------------------------------------
            var oStatusSelect = this.byId("salesStatusFilter");
            var sStatus = oStatusSelect ? oStatusSelect.getSelectedKey() : "";

            if (sStatus) {
                aFilters.push(
                    new Filter("status", FilterOperator.EQ, sStatus)
                );
            }

            // -------------------------------------------------
            // Date range filter (saleDate between From and To)
            // saleDate is stored as an ISO string, so we parse
            // it manually inside a custom test function instead
            // of relying on BT/GE/LE against Date objects
            // -------------------------------------------------
            var oDateFrom = this.byId("salesDateFrom");
            var oDateTo = this.byId("salesDateTo");

            var oFromDate = oDateFrom ? oDateFrom.getDateValue() : null;
            var oToDate = oDateTo ? oDateTo.getDateValue() : null;

            if (oFromDate || oToDate) {

                var iFromTime = oFromDate ? new Date(
                    oFromDate.getFullYear(),
                    oFromDate.getMonth(),
                    oFromDate.getDate(),
                    0, 0, 0, 0
                ).getTime() : null;

                var iToTime = oToDate ? new Date(
                    oToDate.getFullYear(),
                    oToDate.getMonth(),
                    oToDate.getDate(),
                    23, 59, 59, 999
                ).getTime() : null;

                aFilters.push(
                    new Filter({
                        path: "saleDate",
                        test: function (sSaleDate) {

                            if (!sSaleDate) {
                                return false;
                            }

                            var iRowTime = new Date(sSaleDate).getTime();

                            if (isNaN(iRowTime)) {
                                return false;
                            }

                            if (iFromTime !== null && iRowTime < iFromTime) {
                                return false;
                            }

                            if (iToTime !== null && iRowTime > iToTime) {
                                return false;
                            }

                            return true;
                        }
                    })
                );
            }

            // -------------------------------------------------
            // Set contextual "no data" message BEFORE filtering
            // -------------------------------------------------
            oTable.setNoDataText(
                this._buildSalesNoDataText(sQuery, sStatus, oFromDate, oToDate)
            );

            // Apply all active filters together (AND across categories)
            oBinding.filter(aFilters);

            MessageToast.show("Filters applied.");
        },

        // =========================================================
        // BUILD CONTEXTUAL "NO DATA" MESSAGE FOR SALES
        // =========================================================

        _buildSalesNoDataText: function (sQuery, sStatus, oFromDate, oToDate) {

            var aParts = [];

            if (sQuery) {
                aParts.push("matching \"" + sQuery + "\"");
            }

            if (sStatus) {
                aParts.push("with status \"" + sStatus + "\"");
            }

            if (oFromDate || oToDate) {
                aParts.push("in the selected date range");
            }

            if (aParts.length === 0) {
                return "No sales available";
            }

            return "No sales found " + aParts.join(" ") + ".";
        },

        // =========================================================
        // CLEAR SALES FILTERS
        // =========================================================

        onClearSalesFilters: function () {

            var oSearchField = this.byId("salesSearchField");
            var oStatusSelect = this.byId("salesStatusFilter");
            var oDateFrom = this.byId("salesDateFrom");
            var oDateTo = this.byId("salesDateTo");
            var oTable = this.byId("salesTable");

            if (oSearchField) {
                oSearchField.setValue("");
            }

            if (oStatusSelect) {
                oStatusSelect.setSelectedKey("");
            }

            if (oDateFrom) {
                oDateFrom.setValue("");
            }

            if (oDateTo) {
                oDateTo.setValue("");
            }

            if (oTable) {
                oTable.setNoDataText("No sales available");

                var oBinding = oTable.getBinding("items");

                if (oBinding) {
                    oBinding.filter([]);
                }
            }

            MessageToast.show("Sales filters cleared.");
        }
    });

});