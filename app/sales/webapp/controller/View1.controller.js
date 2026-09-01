sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (
    Controller,
    JSONModel,
    MessageToast,
    MessageBox
) {

    "use strict";

    return Controller.extend(
    "sales.controller.View1",
        {

            // =====================================================
            // INIT
            // =====================================================

            onInit: function () {

                this.oLocalModel = new JSONModel({
                    products: [],
                    sales: []
                });

                this.getView().setModel(
                    this.oLocalModel,
                    "local"
                );

                this.oSelectedProduct = null;
                this.oSelectedSale = null;

                this._loadProducts();
                this._loadSales();
            },


            // =====================================================
            // LOAD PRODUCTS
            // =====================================================

            _loadProducts: async function () {

                try {

                    const response = await fetch(
                        "/odata/v4/sales-inventory/Products"
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

                    console.log(
                        "Products loaded:",
                        data.value
                    );

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


            // =====================================================
            // LOAD SALES
            // =====================================================

            _loadSales: async function () {

                try {

                    const response = await fetch(
                        "/odata/v4/sales-inventory/Sales"
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

                    console.log(
                        "Sales loaded:",
                        data.value
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


            // =====================================================
            // PRODUCT SELECTION
            // =====================================================

            onProductSelectionChange: function (oEvent) {

                this.oSelectedProduct =
                    oEvent.getParameter("listItem");

            },


            // =====================================================
            // SALE SELECTION
            // =====================================================

            onSaleSelectionChange: function (oEvent) {

                this.oSelectedSale =
                    oEvent.getParameter("listItem");

            },


            // =====================================================
            // ACTIVATE PRODUCT
            // =====================================================

            onActivateProduct: async function () {

                const oItem =
                    this.oSelectedProduct ||
                    this.byId("productsTable").getSelectedItem();

                if (!oItem) {

                    MessageToast.show(
                        "Please select a product first."
                    );

                    return;
                }

                const oContext =
                    oItem.getBindingContext("local");

                const sID =
                    oContext.getProperty("ID");

                try {

                    await this._callAction(
                        "activateProduct",
                        {
                            ID: sID
                        }
                    );

                    MessageToast.show(
                        "Product activated successfully."
                    );

                    await this._loadProducts();

                    this._clearProductSelection();

                } catch (error) {

                    MessageBox.error(
                        this._getErrorMessage(error)
                    );
                }
            },


            // =====================================================
            // DEACTIVATE PRODUCT
            // =====================================================

            onDeactivateProduct: async function () {

                const oItem =
                    this.oSelectedProduct ||
                    this.byId("productsTable").getSelectedItem();

                if (!oItem) {

                    MessageToast.show(
                        "Please select a product first."
                    );

                    return;
                }

                const oContext =
                    oItem.getBindingContext("local");

                const sID =
                    oContext.getProperty("ID");

                try {

                    await this._callAction(
                        "deactivateProduct",
                        {
                            ID: sID
                        }
                    );

                    MessageToast.show(
                        "Product deactivated successfully."
                    );

                    await this._loadProducts();

                    this._clearProductSelection();

                } catch (error) {

                    MessageBox.error(
                        this._getErrorMessage(error)
                    );
                }
            },


            // =====================================================
            // GET PRODUCT STOCK
            // =====================================================

            onGetStock: async function () {

                const oItem =
                    this.oSelectedProduct ||
                    this.byId("productsTable").getSelectedItem();

                if (!oItem) {

                    MessageToast.show(
                        "Please select a product first."
                    );

                    return;
                }

                const oContext =
                    oItem.getBindingContext("local");

                const sID =
                    oContext.getProperty("ID");

                try {

                    const result =
                        await this._callAction(
                            "getProductStock",
                            {
                                ID: sID
                            }
                        );

                    let stock = result;

                    if (
                        result &&
                        typeof result === "object" &&
                        result.value !== undefined
                    ) {
                        stock = result.value;
                    }

                    MessageBox.information(
                        "Current stock quantity: " +
                        stock
                    );

                } catch (error) {

                    MessageBox.error(
                        this._getErrorMessage(error)
                    );
                }
            },


            // =====================================================
            // COMPLETE SALE
            // =====================================================

            onCompleteSale: async function () {

                const oItem =
                    this.oSelectedSale ||
                    this.byId("salesTable").getSelectedItem();

                if (!oItem) {

                    MessageToast.show(
                        "Please select a sale first."
                    );

                    return;
                }

                const oContext =
                    oItem.getBindingContext("local");

                const sID =
                    oContext.getProperty("ID");

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

                    this._clearSaleSelection();

                } catch (error) {

                    MessageBox.error(
                        this._getErrorMessage(error)
                    );
                }
            },


            // =====================================================
            // CANCEL SALE
            // =====================================================

            onCancelSale: async function () {

                const oItem =
                    this.oSelectedSale ||
                    this.byId("salesTable").getSelectedItem();

                if (!oItem) {

                    MessageToast.show(
                        "Please select a sale first."
                    );

                    return;
                }

                const oContext =
                    oItem.getBindingContext("local");

                const sID =
                    oContext.getProperty("ID");

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


            // =====================================================
            // NEW SALE
            // =====================================================

            onNewSale: function () {

                MessageToast.show(
                    "New Sale functionality can be added next."
                );

            },


            // =====================================================
            // REFRESH
            // =====================================================

            onRefresh: async function () {

                try {

                    await Promise.all([
                        this._loadProducts(),
                        this._loadSales()
                    ]);

                    this._clearProductSelection();
                    this._clearSaleSelection();

                    MessageToast.show(
                        "Data refreshed successfully."
                    );

                } catch (error) {

                    console.error(error);
                }
            },


            // =====================================================
            // GENERIC ACTION CALL
            // =====================================================

            _callAction: async function (
                sAction,
                oPayload
            ) {

                const response = await fetch(
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

                        body: JSON.stringify(
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


            // =====================================================
            // CLEAR PRODUCT SELECTION
            // =====================================================

            _clearProductSelection: function () {

                this.oSelectedProduct = null;

                const oTable =
                    this.byId("productsTable");

                if (oTable) {
                    oTable.removeSelections(true);
                }
            },


            // =====================================================
            // CLEAR SALE SELECTION
            // =====================================================

            _clearSaleSelection: function () {

                this.oSelectedSale = null;

                const oTable =
                    this.byId("salesTable");

                if (oTable) {
                    oTable.removeSelections(true);
                }
            },


            // =====================================================
            // ERROR MESSAGE
            // =====================================================

            _getErrorMessage: function (error) {

                if (!error) {
                    return "Unknown error occurred.";
                }

                if (error.message) {
                    return error.message;
                }

                return String(error);
            }

        }
    );
});