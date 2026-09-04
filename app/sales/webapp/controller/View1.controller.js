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
    "sap/m/Select",
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

                currentPage: "dashboard",

                products: [],

                sales: [],

                customers: [],

                inventoryRows: [],

                inventoryFilters: {
                    warehouses: []
                },

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
            ])
                .then(
                    async function () {

                        this._computeAnalytics();

                        await this._loadInventory();

                    }.bind(this)
                )
                .catch(
                    function (error) {

                        console.error(
                            "Initial loading error:",
                            error
                        );

                    }
                );

        },


        // =========================================================
        // NAVIGATION
        // =========================================================

        onSideNavToggle: function () {

            var oToolPage =
                this.byId("toolPage");

            if (!oToolPage) {
                return;
            }

            oToolPage.setSideExpanded(
                !oToolPage.getSideExpanded()
            );

        },


        onSideNavItemSelect: function (oEvent) {

            var oItem =
                oEvent.getParameter("item");

            if (!oItem) {
                return;
            }

            var sKey =
                oItem.getKey();

            if (sKey) {

                this.oLocalModel.setProperty(
                    "/currentPage",
                    sKey
                );

            }

        },


        onTabSelect: function (oEvent) {

            var sKey =
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


        onViewAllAnalytics: function () {

            this.oLocalModel.setProperty(
                "/currentPage",
                "analytics"
            );

        },


        // =========================================================
        // LOAD PRODUCTS
        // =========================================================

        _loadProducts: async function () {

            try {

                var response =
                    await fetch(
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

                var data =
                    await response.json();

                var aProducts =
                    data.value || [];

                this.oLocalModel.setProperty(
                    "/products",
                    aProducts
                );

                var oInventoryTable =
                    this.byId("inventoryTable");

                if (oInventoryTable) {

                    var oBinding =
                        oInventoryTable.getBinding(
                            "items"
                        );

                    if (oBinding) {
                        oBinding.refresh();
                    }

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

                var response =
                    await fetch(
                        "/odata/v4/sales-inventory/Sales?$expand=customer,product($expand=category)&$orderby=saleDate desc"
                    );

                if (!response.ok) {

                    throw new Error(
                        "Sales request failed: " +
                        response.status +
                        " " +
                        response.statusText
                    );

                }

                var data =
                    await response.json();

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

                var response =
                    await fetch(
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

                var data =
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
                oEvent.getParameter(
                    "listItem"
                );

        },


        // =========================================================
        // SALE SELECTION
        // =========================================================

        onSaleSelectionChange: function (oEvent) {

            this.oSelectedSale =
                oEvent.getParameter(
                    "listItem"
                );

            var bSelected =
                !!this.oSelectedSale;

            var oComplete =
                this.byId(
                    "completeSaleButton"
                );

            var oCancel =
                this.byId(
                    "cancelSaleButton"
                );

            if (oComplete) {
                oComplete.setEnabled(
                    bSelected
                );
            }

            if (oCancel) {
                oCancel.setEnabled(
                    bSelected
                );
            }

        },


        // =========================================================
        // SALES FILTER
        // =========================================================

        onApplySaleFilter: function () {

            var oTable =
                this.byId("salesTable");

            if (!oTable) {
                return;
            }

            var oBinding =
                oTable.getBinding("items");

            if (!oBinding) {
                return;
            }

            var oStatus =
                this.byId(
                    "saleStatusFilter"
                );

            var oStart =
                this.byId(
                    "startDateFilter"
                );

            var oEnd =
                this.byId(
                    "endDateFilter"
                );

            var sStatus =
                oStatus
                    ? oStatus.getSelectedKey()
                    : "ALL";

            var sStart =
                oStart
                    ? oStart.getValue()
                    : "";

            var sEnd =
                oEnd
                    ? oEnd.getValue()
                    : "";

            if (
                sStart &&
                sEnd &&
                sStart > sEnd
            ) {

                MessageBox.warning(
                    "Start Date cannot be greater than End Date."
                );

                return;

            }

            var aFilters = [];


            if (
                sStatus &&
                sStatus !== "ALL"
            ) {

                aFilters.push(
                    new Filter(
                        "status",
                        FilterOperator.EQ,
                        sStatus
                    )
                );

            }


            if (sStart || sEnd) {

                aFilters.push(
                    new Filter({

                        path: "saleDate",

                        test: function (sDate) {

                            if (!sDate) {
                                return false;
                            }

                            var oDate =
                                new Date(sDate);

                            if (
                                isNaN(
                                    oDate.getTime()
                                )
                            ) {
                                return false;
                            }

                            var sDateOnly =
                                oDate
                                    .toISOString()
                                    .substring(
                                        0,
                                        10
                                    );

                            if (
                                sStart &&
                                sDateOnly < sStart
                            ) {
                                return false;
                            }

                            if (
                                sEnd &&
                                sDateOnly > sEnd
                            ) {
                                return false;
                            }

                            return true;

                        }

                    })
                );

            }


            oBinding.filter(
                aFilters,
                "Application"
            );

            this._clearSaleSelection();

            var iCount =
                oBinding.getLength();

            if (iCount === 0) {

                MessageToast.show(
                    "No sales found for the selected filters."
                );

            } else {

                MessageToast.show(
                    iCount +
                    " sale(s) found."
                );

            }

        },


        // =========================================================
        // CLEAR SALES FILTER
        // =========================================================

        onClearSaleFilter: function () {

            var oTable =
                this.byId("salesTable");

            if (oTable) {

                var oBinding =
                    oTable.getBinding(
                        "items"
                    );

                if (oBinding) {

                    oBinding.filter(
                        [],
                        "Application"
                    );

                }

            }

            var oStatus =
                this.byId(
                    "saleStatusFilter"
                );

            var oStart =
                this.byId(
                    "startDateFilter"
                );

            var oEnd =
                this.byId(
                    "endDateFilter"
                );

            if (oStatus) {
                oStatus.setSelectedKey(
                    "ALL"
                );
            }

            if (oStart) {
                oStart.setValue("");
            }

            if (oEnd) {
                oEnd.setValue("");
            }

            this._clearSaleSelection();

            MessageToast.show(
                "Sales filters cleared."
            );

        },


        // =========================================================
        // NEW SALE
        // =========================================================

        onNewSale: async function () {

            try {

                var aCustomers =
                    this.oLocalModel.getProperty(
                        "/customers"
                    ) || [];

                var aProducts =
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


                var oCustomerSelect =
                    new Select({
                        width: "100%"
                    });


                aCustomers.forEach(
                    function (oCustomer) {

                        oCustomerSelect.addItem(
                            new Item({
                                key:
                                    oCustomer.ID,

                                text:
                                    oCustomer.customerName
                            })
                        );

                    }
                );


                var oProductSelect =
                    new Select({
                        width: "100%"
                    });


                aProducts.forEach(
                    function (oProduct) {

                        var iStock =
                            Number(
                                oProduct.stockQty || 0
                            );

                        oProductSelect.addItem(
                            new Item({

                                key:
                                    oProduct.ID,

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


                var oQuantityInput =
                    new Input({
                        type: "Number",
                        value: "1",
                        width: "100%",
                        placeholder:
                            "Enter quantity"
                    });


                var oDialog =
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
                                    }),

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


                        beginButton:
                            new Button({

                                text:
                                    "Create Sale",

                                type:
                                    "Emphasized",

                                press:
                                    async function () {

                                        var sCustomerID =
                                            oCustomerSelect
                                                .getSelectedKey();

                                        var sProductID =
                                            oProductSelect
                                                .getSelectedKey();

                                        var iQuantity =
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


                                        var oProduct =
                                            aProducts.find(
                                                function (
                                                    oItem
                                                ) {

                                                    return (
                                                        String(
                                                            oItem.ID
                                                        ) ===
                                                        String(
                                                            sProductID
                                                        )
                                                    );

                                                }
                                            );


                                        if (!oProduct) {

                                            MessageBox.error(
                                                "Selected product was not found."
                                            );

                                            return;

                                        }


                                        var iStock =
                                            Number(
                                                oProduct.stockQty || 0
                                            );


                                        if (
                                            iStock <
                                            iQuantity
                                        ) {

                                            MessageBox.warning(
                                                "Insufficient stock.\n\n" +
                                                "Available stock: " +
                                                iStock +
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
                                                error
                                            );

                                        }

                                    }.bind(this)

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

            var response =
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

                var sMessage =
                    "Unable to create sale.";

                try {

                    var oError =
                        await response.json();

                    if (
                        oError &&
                        oError.error &&
                        oError.error.message
                    ) {

                        sMessage =
                            oError.error.message;

                    }

                } catch (e) {
                    // Ignore
                }

                throw new Error(
                    sMessage
                );

            }


            var oCreated =
                await response.json();


            await this._loadSales();
            await this._loadProducts();
            await this._loadInventory();

            this._computeAnalytics();

            this._reapplySaleFilters();
            this._reapplyInventoryFilters();


            MessageToast.show(
                "Sale created successfully. Status: Pending."
            );


            return oCreated;

        },


        // =========================================================
        // COMPLETE SALE
        // =========================================================

        onCompleteSale: async function () {

            var oItem =
                this.oSelectedSale ||
                this.byId(
                    "salesTable"
                ).getSelectedItem();


            if (!oItem) {

                MessageToast.show(
                    "Please select a sale first."
                );

                return;

            }


            var oContext =
                oItem.getBindingContext(
                    "local"
                );


            if (!oContext) {

                MessageBox.error(
                    "Sale context could not be found."
                );

                return;

            }


            var sID =
                oContext.getProperty(
                    "ID"
                );


            try {

                await this._callAction(
                    "completeSale",
                    {
                        ID: sID
                    }
                );


                await this._loadSales();
                await this._loadProducts();
                await this._loadInventory();

                this._computeAnalytics();

                this._reapplySaleFilters();
                this._reapplyInventoryFilters();

                this._clearSaleSelection();


                MessageToast.show(
                    "Sale completed successfully."
                );

            } catch (error) {

                MessageBox.error(
                    this._getErrorMessage(
                        error
                    )
                );

            }

        },


        // =========================================================
        // CANCEL SALE
        // =========================================================

        onCancelSale: async function () {

            var oItem =
                this.oSelectedSale ||
                this.byId(
                    "salesTable"
                ).getSelectedItem();


            if (!oItem) {

                MessageToast.show(
                    "Please select a sale first."
                );

                return;

            }


            var oContext =
                oItem.getBindingContext(
                    "local"
                );


            if (!oContext) {

                MessageBox.error(
                    "Sale context could not be found."
                );

                return;

            }


            var sID =
                oContext.getProperty(
                    "ID"
                );


            try {

                await this._callAction(
                    "cancelSale",
                    {
                        ID: sID
                    }
                );


                await this._loadSales();
                await this._loadProducts();
                await this._loadInventory();

                this._computeAnalytics();

                this._reapplySaleFilters();
                this._reapplyInventoryFilters();

                this._clearSaleSelection();


                MessageToast.show(
                    "Sale cancelled successfully."
                );

            } catch (error) {

                MessageBox.error(
                    this._getErrorMessage(
                        error
                    )
                );

            }

        },


        // =========================================================
        // REFRESH ALL
        // =========================================================

        onRefresh: async function () {

            try {

                await Promise.all([
                    this._loadProducts(),
                    this._loadSales(),
                    this._loadCustomers()
                ]);

                await this._loadInventory();

                this._computeAnalytics();

                this._clearProductSelection();
                this._clearSaleSelection();

                this._reapplySaleFilters();
                this._reapplyInventoryFilters();


                MessageToast.show(
                    "Data refreshed successfully."
                );

            } catch (error) {

                console.error(
                    "Refresh error:",
                    error
                );

            }

        },


        // =========================================================
        // REAPPLY SALES FILTER
        // =========================================================

        _reapplySaleFilters: function () {

            var oStatus =
                this.byId(
                    "saleStatusFilter"
                );

            var oStart =
                this.byId(
                    "startDateFilter"
                );

            var oEnd =
                this.byId(
                    "endDateFilter"
                );


            if (
                !oStatus ||
                !oStart ||
                !oEnd
            ) {
                return;
            }


            var bHasFilter =
                oStatus.getSelectedKey() !==
                    "ALL" ||

                !!oStart.getValue() ||

                !!oEnd.getValue();


            if (bHasFilter) {

                this.onApplySaleFilter();

            } else {

                var oTable =
                    this.byId(
                        "salesTable"
                    );

                var oBinding =
                    oTable &&
                    oTable.getBinding(
                        "items"
                    );


                if (oBinding) {

                    oBinding.filter(
                        [],
                        "Application"
                    );

                }

            }

        },


        // =========================================================
        // GENERIC ACTION
        // =========================================================

        _callAction: async function (
            sAction,
            oPayload
        ) {

            var response =
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

                var sMessage =
                    "Action failed: " +
                    response.status;


                try {

                    var oError =
                        await response.json();

                    if (
                        oError &&
                        oError.error &&
                        oError.error.message
                    ) {

                        sMessage =
                            oError.error.message;

                    }

                } catch (e) {
                    // Ignore
                }


                throw new Error(
                    sMessage
                );

            }


            var sText =
                await response.text();


            if (!sText) {
                return null;
            }


            try {

                return JSON.parse(
                    sText
                );

            } catch (e) {

                return sText;

            }

        },


        // =========================================================
        // PRODUCT NAME
        // =========================================================

        getProductName: function (
            sProductID
        ) {

            if (
                sProductID ===
                undefined ||
                sProductID ===
                null
            ) {
                return "";
            }


            var aProducts =
                this.oLocalModel
                    .getProperty(
                        "/products"
                    ) || [];


            var sID =
                String(
                    sProductID
                );


            var oProduct =
                aProducts.find(
                    function (oProduct) {

                        if (!oProduct) {
                            return false;
                        }

                        return (
                            String(
                                oProduct.ID
                            ) === sID
                        );

                    }
                );


            return oProduct
                ? oProduct.productName
                : "Unknown Product";

        },


        // =========================================================
        // ANALYTICS
        // =========================================================

        _computeAnalytics: function () {

            var aSales =
                this.oLocalModel.getProperty(
                    "/sales"
                ) || [];


            if (
                aSales.length === 0
            ) {

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


            var totalRevenue =
                aSales.reduce(
                    function (
                        total,
                        oSale
                    ) {

                        return (
                            total +
                            (
                                Number(
                                    oSale.totalAmount
                                ) || 0
                            )
                        );

                    },
                    0
                );


            var totalSalesCount =
                aSales.length;


            var avgSaleValue =
                totalSalesCount
                    ? totalRevenue /
                      totalSalesCount
                    : 0;


            var completedCount =
                aSales.filter(
                    function (oSale) {

                        return (
                            oSale.status ===
                            "Completed"
                        );

                    }
                ).length;


            var completionRate =
                totalSalesCount
                    ? (
                        completedCount /
                        totalSalesCount
                    ) * 100
                    : 0;


            // -----------------------------------------------------
            // SALES TREND
            // -----------------------------------------------------

            var oTrendMap = {};


            aSales.forEach(
                function (oSale) {

                    var sDate =
                        oSale.saleDate
                            ? String(
                                oSale.saleDate
                            ).split("T")[0]
                            : "Unknown";


                    oTrendMap[sDate] =
                        (
                            oTrendMap[sDate] ||
                            0
                        ) +
                        (
                            Number(
                                oSale.totalAmount
                            ) || 0
                        );

                }
            );


            var salesTrend =
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


            // -----------------------------------------------------
            // CATEGORY
            // -----------------------------------------------------

            var oCategoryMap = {};


            aSales.forEach(
                function (oSale) {

                    var sCategory =
                        oSale.product &&
                        oSale.product.category &&
                        oSale.product.category.categoryName
                            ? oSale.product.category.categoryName
                            : "Uncategorized";


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
                                oSale.totalAmount
                            ) || 0
                        );

                }
            );


            var categoryBreakdown =
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
                                        ? Math.round(
                                            (
                                                oCategoryMap[
                                                    sCategory
                                                ] /
                                                totalRevenue
                                            ) * 100
                                        )
                                        : 0

                            };

                        }
                    )
                    .sort(
                        function (a, b) {

                            return (
                                b.percent -
                                a.percent
                            );

                        }
                    );


            // -----------------------------------------------------
            // TOP PRODUCTS
            // -----------------------------------------------------

            var oProductMap = {};


            aSales.forEach(
                function (oSale) {

                    var sProductName =
                        oSale.product &&
                        oSale.product.productName
                            ? oSale.product.productName
                            : "Unknown";


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
                                oSale.totalAmount
                            ) || 0
                        );

                }
            );


            var topProducts =
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
                        function (a, b) {

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


        // =========================================================
        // ANALYTICS REFRESH
        // =========================================================

        onRefreshAnalytics: async function () {

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
        // LOAD INVENTORY
        //
        // IMPORTANT:
        // We use the existing OData V4 model named "inventory".
        //
        // We do NOT call:
        //
        // /odata/v4/sales-inventory/Inventory
        //
        // using fetch because your application previously returned
        // 404 for that request.
        // =========================================================

        _loadInventory: async function () {

            try {

                var oModel =
                    this.getView()
                        .getModel(
                            "inventory"
                        );


                if (!oModel) {

                    throw new Error(
                        "Inventory OData model is not available. " +
                        "Please check manifest.json."
                    );

                }


                var oListBinding =
                    oModel.bindList(
                        "/Inventory",
                        undefined,
                        undefined,
                        undefined,
                        {
                            $expand:
                                "warehouse"
                        }
                    );


                var aContexts =
                    await oListBinding.requestContexts(
                        0,
                        1000
                    );


                var aProducts =
                    this.oLocalModel
                        .getProperty(
                            "/products"
                        ) || [];


                // =====================================================
                // CREATE LOCAL INVENTORY ROWS
                // =====================================================

                var aInventory =
                    aContexts.map(
                        function (
                            oContext
                        ) {

                            var oRow =
                                oContext.getObject();


                            // -------------------------------------------------
                            // PRODUCT
                            // -------------------------------------------------

                            var sProductID =
                                oRow.product_ID !==
                                    undefined &&
                                oRow.product_ID !==
                                    null
                                    ? String(
                                        oRow.product_ID
                                    )
                                    : "";


                            var oProduct =
                                aProducts.find(
                                    function (
                                        oProductItem
                                    ) {

                                        if (
                                            !oProductItem
                                        ) {
                                            return false;
                                        }


                                        return (
                                            String(
                                                oProductItem.ID
                                            ) ===
                                            sProductID
                                        );

                                    }
                                );


                            // -------------------------------------------------
                            // STOCK
                            // -------------------------------------------------

                            var iStockQty =
                                Number(
                                    oRow.stockQty
                                ) || 0;


                            var iReservedQty =
                                Number(
                                    oRow.reservedQty
                                ) || 0;


                            var iAvailableQty =
                                iStockQty -
                                iReservedQty;


                            // -------------------------------------------------
                            // STOCK %
                            // -------------------------------------------------

                            var iStockPercent =
                                0;


                            if (
                                iStockQty > 0
                            ) {

                                iStockPercent =
                                    (
                                        iAvailableQty /
                                        iStockQty
                                    ) * 100;

                            }


                            iStockPercent =
                                Math.max(
                                    0,
                                    Math.min(
                                        100,
                                        iStockPercent
                                    )
                                );


                            // -------------------------------------------------
                            // STOCK STATUS
                            // -------------------------------------------------

                            var sStockStatus =
                                "Out of Stock";


                            if (
                                iAvailableQty > 20
                            ) {

                                sStockStatus =
                                    "In Stock";

                            } else if (
                                iAvailableQty > 0
                            ) {

                                sStockStatus =
                                    "Low Stock";

                            }


                            // -------------------------------------------------
                            // WAREHOUSE
                            // -------------------------------------------------

                            var oWarehouse =
                                oRow.warehouse ||
                                {};


                            var sWarehouseName =
                                oWarehouse.warehouseName ||
                                oRow.warehouseName ||
                                "Unknown Warehouse";


                            var sWarehouseCode =
                                oWarehouse.warehouseCode ||
                                oRow.warehouseCode ||
                                "";


                            var sWarehouseKey =
                                sWarehouseCode ||
                                sWarehouseName;


                            // -------------------------------------------------
                            // RETURN LOCAL ROW
                            // -------------------------------------------------

                            return {

                                ID:
                                    oRow.ID,

                                product_ID:
                                    oRow.product_ID,

                                productName:
                                    oProduct &&
                                    oProduct.productName
                                        ? oProduct.productName
                                        : "Unknown Product",

                                warehouse:
                                    oWarehouse,

                                warehouseName:
                                    sWarehouseName,

                                warehouseCode:
                                    sWarehouseCode,

                                warehouseKey:
                                    sWarehouseKey,

                                stockQty:
                                    iStockQty,

                                reservedQty:
                                    iReservedQty,

                                availableQty:
                                    iAvailableQty,

                                stockPercent:
                                    iStockPercent,

                                stockStatus:
                                    sStockStatus,

                                lastUpdated:
                                    oRow.lastUpdated

                            };

                        }
                    );


                // =====================================================
                // SAVE INVENTORY
                // =====================================================

                this.oLocalModel.setProperty(
                    "/inventoryRows",
                    aInventory
                );


                // =====================================================
                // CREATE WAREHOUSE DROPDOWN
                //
                // We build this from Inventory itself.
                //
                // This avoids another /Warehouses request and avoids
                // the 404 problem you were seeing.
                // =====================================================

                var oWarehouseMap =
                    {};


                aInventory.forEach(
                    function (
                        oRow
                    ) {

                        if (
                            !oRow ||
                            !oRow.warehouseKey
                        ) {
                            return;
                        }


                        var sKey =
                            oRow.warehouseKey;


                        if (
                            !oWarehouseMap[
                                sKey
                            ]
                        ) {

                            oWarehouseMap[
                                sKey
                            ] = {

                                ID:
                                    sKey,

                                warehouseName:
                                    oRow.warehouseName,

                                warehouseCode:
                                    oRow.warehouseCode

                            };

                        }

                    }
                );


                // "All Warehouses" MUST be first.

                var aWarehouses = [

                    {

                        ID:
                            "ALL",

                        warehouseName:
                            "All Warehouses",

                        warehouseCode:
                            ""

                    }

                ];


                Object.keys(
                    oWarehouseMap
                )
                    .sort(
                        function (a, b) {

                            return (
                                oWarehouseMap[a]
                                    .warehouseName
                                    .localeCompare(
                                        oWarehouseMap[b]
                                            .warehouseName
                                    )
                            );

                        }
                    )
                    .forEach(
                        function (
                            sKey
                        ) {

                            aWarehouses.push(
                                oWarehouseMap[
                                    sKey
                                ]
                            );

                        }
                    );


                this.oLocalModel.setProperty(
                    "/inventoryFilters/warehouses",
                    aWarehouses
                );


                console.log(
                    "Inventory:",
                    aInventory
                );

                console.log(
                    "Warehouses:",
                    aWarehouses
                );

            } catch (error) {

                console.error(
                    "Inventory loading error:",
                    error
                );

                MessageBox.error(
                    "Unable to load Inventory.\n\n" +
                    this._getErrorMessage(
                        error
                    )
                );

            }

        },


        // =========================================================
        // INVENTORY REFRESH
        // =========================================================

        onRefreshInventory: async function () {

            try {

                await this._loadProducts();

                await this._loadInventory();

                this._reapplyInventoryFilters();


                MessageToast.show(
                    "Inventory refreshed successfully."
                );

            } catch (error) {

                console.error(
                    "Inventory refresh error:",
                    error
                );

            }

        },


        // =========================================================
        // INVENTORY FILTER
        // =========================================================

        onApplyInventoryFilter: function () {

            var oTable =
                this.byId(
                    "inventoryTable"
                );


            if (!oTable) {
                return;
            }


            var oBinding =
                oTable.getBinding(
                    "items"
                );


            if (!oBinding) {
                return;
            }


            var oProduct =
                this.byId(
                    "inventoryProductFilter"
                );


            var oWarehouse =
                this.byId(
                    "inventoryWarehouseFilter"
                );


            var oStock =
                this.byId(
                    "inventoryStockFilter"
                );


            var sProduct =
                oProduct
                    ? oProduct
                        .getValue()
                        .trim()
                        .toLowerCase()
                    : "";


            var sWarehouse =
                oWarehouse
                    ? oWarehouse
                        .getSelectedKey()
                    : "ALL";


            var sStock =
                oStock
                    ? oStock
                        .getSelectedKey()
                    : "ALL";


            var aFilters = [];


            // =====================================================
            // PRODUCT NAME
            // =====================================================

            if (sProduct) {

                aFilters.push(

                    new Filter(
                        "productName",
                        FilterOperator.Contains,
                        sProduct
                    )

                );

            }


            // =====================================================
            // WAREHOUSE
            // =====================================================

            if (
                sWarehouse &&
                sWarehouse !== "ALL"
            ) {

                aFilters.push(

                    new Filter(
                        "warehouseKey",
                        FilterOperator.EQ,
                        sWarehouse
                    )

                );

            }


            // =====================================================
            // STOCK STATUS
            // =====================================================

            if (
                sStock ===
                "IN_STOCK"
            ) {

                aFilters.push(

                    new Filter(
                        "availableQty",
                        FilterOperator.GT,
                        20
                    )

                );

            }


            else if (
                sStock ===
                "LOW_STOCK"
            ) {

                aFilters.push(

                    new Filter({

                        filters: [

                            new Filter(
                                "availableQty",
                                FilterOperator.GT,
                                0
                            ),

                            new Filter(
                                "availableQty",
                                FilterOperator.LE,
                                20
                            )

                        ],

                        and: true

                    })

                );

            }


            else if (
                sStock ===
                "OUT_OF_STOCK"
            ) {

                aFilters.push(

                    new Filter(
                        "availableQty",
                        FilterOperator.LE,
                        0
                    )

                );

            }


            // =====================================================
            // APPLY
            // =====================================================

            oBinding.filter(
                aFilters,
                "Application"
            );


            var iCount =
                oBinding.getLength();


            if (iCount === 0) {

                MessageToast.show(
                    "No inventory records found."
                );

            } else {

                MessageToast.show(
                    iCount +
                    " inventory record(s) found."
                );

            }

        },


        // =========================================================
        // CLEAR INVENTORY FILTER
        // =========================================================

        onClearInventoryFilter: function () {

            var oTable =
                this.byId(
                    "inventoryTable"
                );


            if (oTable) {

                var oBinding =
                    oTable.getBinding(
                        "items"
                    );


                if (oBinding) {

                    oBinding.filter(
                        [],
                        "Application"
                    );

                }

            }


            var oProduct =
                this.byId(
                    "inventoryProductFilter"
                );


            var oWarehouse =
                this.byId(
                    "inventoryWarehouseFilter"
                );


            var oStock =
                this.byId(
                    "inventoryStockFilter"
                );


            if (oProduct) {

                oProduct.setValue(
                    ""
                );

            }


            if (oWarehouse) {

                oWarehouse.setSelectedKey(
                    "ALL"
                );

            }


            if (oStock) {

                oStock.setSelectedKey(
                    "ALL"
                );

            }


            MessageToast.show(
                "Inventory filters cleared."
            );

        },


        // =========================================================
        // REAPPLY INVENTORY FILTERS
        // =========================================================

        _reapplyInventoryFilters: function () {

            var oProduct =
                this.byId(
                    "inventoryProductFilter"
                );

            var oWarehouse =
                this.byId(
                    "inventoryWarehouseFilter"
                );

            var oStock =
                this.byId(
                    "inventoryStockFilter"
                );


            if (
                !oProduct ||
                !oWarehouse ||
                !oStock
            ) {
                return;
            }


            var bHasFilter =
                !!oProduct
                    .getValue()
                    .trim() ||

                oWarehouse
                    .getSelectedKey() !==
                    "ALL" ||

                oStock
                    .getSelectedKey() !==
                    "ALL";


            if (bHasFilter) {

                this.onApplyInventoryFilter();

            } else {

                var oTable =
                    this.byId(
                        "inventoryTable"
                    );


                var oBinding =
                    oTable &&
                    oTable.getBinding(
                        "items"
                    );


                if (oBinding) {

                    oBinding.filter(
                        [],
                        "Application"
                    );

                }

            }

        },


        // =========================================================
        // INVENTORY ACTION MODEL
        // =========================================================

        _getInventoryModel: function () {

            return this.getView()
                .getModel(
                    "inventory"
                );

        },


        _callInventoryAction:
            async function (
                sActionName,
                mParams
            ) {

                var oModel =
                    this._getInventoryModel();


                if (!oModel) {

                    throw new Error(
                        "Inventory OData model is not available."
                    );

                }


                try {

                    var oAction =
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
                                mParams[
                                    sKey
                                ]
                            );

                        }
                    );


                    var result =
                        await oAction.execute();


                    await this._loadProducts();

                    await this._loadInventory();

                    this._computeAnalytics();

                    this._reapplyInventoryFilters();


                    MessageToast.show(
                        sActionName +
                        " successful"
                    );


                    return result;

                } catch (error) {

                    console.error(
                        "Inventory action error:",
                        error
                    );

                    MessageBox.error(
                        this._getErrorMessage(
                            error
                        )
                    );

                    throw error;

                }

            },


        // =========================================================
        // FIND INVENTORY ROW
        // =========================================================

        _getRowContext: function (
            oEvent
        ) {

            var oControl =
                oEvent.getSource();


            while (oControl) {

                var oLocalContext =
                    oControl.getBindingContext(
                        "local"
                    );


                if (oLocalContext) {

                    return oLocalContext;

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
                    "Inventory ID is missing."
                );

                return;

            }


            var oInput =
                new Input({

                    type:
                        "Number",

                    placeholder:
                        "Enter quantity",

                    width:
                        "100%"

                });


            var oDialog =
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
                                async function () {

                                    var iQuantity =
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

                                        // Error already shown

                                    }

                                }.bind(this)

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

            var oContext =
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

            var oContext =
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

            var oContext =
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

        _clearProductSelection:
            function () {

                this.oSelectedProduct =
                    null;


                var oTable =
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

        _clearSaleSelection:
            function () {

                this.oSelectedSale =
                    null;


                var oTable =
                    this.byId(
                        "salesTable"
                    );


                if (oTable) {

                    oTable.removeSelections(
                        true
                    );

                }


                var oComplete =
                    this.byId(
                        "completeSaleButton"
                    );


                var oCancel =
                    this.byId(
                        "cancelSaleButton"
                    );


                if (oComplete) {

                    oComplete.setEnabled(
                        false
                    );

                }


                if (oCancel) {

                    oCancel.setEnabled(
                        false
                    );

                }

            },


        // =========================================================
        // ERROR
        // =========================================================

        _getErrorMessage:
            function (
                error
            ) {

                if (!error) {

                    return (
                        "Unknown error occurred."
                    );

                }


                if (error.message) {

                    return error.message;

                }


                if (
                    error.error &&
                    error.error.message
                ) {

                    return (
                        error.error.message
                    );

                }


                return String(
                    error
                );

            }

    });

});