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
                sales: []
            });

            this.getView().setModel(this.oLocalModel, "local");

            this.oSelectedProduct = null;
            this.oSelectedSale = null;

            this._loadProducts();
            this._loadSales();

            // Inventory is loaded automatically by the named
            // OData V4 model ("inventory") declared in manifest.json.
            if (!this.getView().getModel("inventory")) {
                console.error("Inventory OData model is not available. Check manifest.json.");
            }
        },


        // =========================================================
        // LOAD PRODUCTS (expand category so category/categoryName resolves)
        // =========================================================

        _loadProducts: async function () {

            try {

                const response = await fetch("/odata/v4/sales-inventory/Products?$expand=category");

                if (!response.ok) {
                    throw new Error(
                        "Products request failed: " + response.status + " " + response.statusText
                    );
                }

                const data = await response.json();

                this.oLocalModel.setProperty("/products", data.value || []);

                // Inventory's Product Name column looks up this same product
                // list via getProductName(), so refresh it now that products
                // have arrived (in case Inventory rendered first).
                const oInventoryTable = this.byId("inventoryTable");
                const oInventoryBinding = oInventoryTable && oInventoryTable.getBinding("items");
                if (oInventoryBinding) {
                    oInventoryBinding.refresh();
                }

            } catch (error) {
                console.error("Product loading error:", error);
                MessageBox.error("Unable to load Products.\n\n" + this._getErrorMessage(error));
            }
        },


        // =========================================================
        // LOAD SALES (expand customer and product so their names resolve)
        // =========================================================

        _loadSales: async function () {

            try {

                const response = await fetch("/odata/v4/sales-inventory/Sales?$expand=customer,product");

                if (!response.ok) {
                    throw new Error(
                        "Sales request failed: " + response.status + " " + response.statusText
                    );
                }

                const data = await response.json();

                this.oLocalModel.setProperty("/sales", data.value || []);

            } catch (error) {
                console.error("Sales loading error:", error);
                MessageBox.error("Unable to load Sales.\n\n" + this._getErrorMessage(error));
            }
        },


        // =========================================================
        // PRODUCT / SALE SELECTION
        // =========================================================

        onProductSelectionChange: function (oEvent) {
            this.oSelectedProduct = oEvent.getParameter("listItem");
        },

        onSaleSelectionChange: function (oEvent) {
            this.oSelectedSale = oEvent.getParameter("listItem");
        },


        // =========================================================
        // ACTIVATE / DEACTIVATE / STOCK (Products tab)
        // =========================================================

        onActivateProduct: async function () {

            const oItem = this.oSelectedProduct || this.byId("productsTable").getSelectedItem();

            if (!oItem) {
                MessageToast.show("Please select a product first.");
                return;
            }

            const sID = oItem.getBindingContext("local").getProperty("ID");

            try {
                await this._callAction("activateProduct", { ID: sID });
                MessageToast.show("Product activated successfully.");
                await this._loadProducts();
                this._clearProductSelection();
            } catch (error) {
                MessageBox.error(this._getErrorMessage(error));
            }
        },

        onDeactivateProduct: async function () {

            const oItem = this.oSelectedProduct || this.byId("productsTable").getSelectedItem();

            if (!oItem) {
                MessageToast.show("Please select a product first.");
                return;
            }

            const sID = oItem.getBindingContext("local").getProperty("ID");

            try {
                await this._callAction("deactivateProduct", { ID: sID });
                MessageToast.show("Product deactivated successfully.");
                await this._loadProducts();
                this._clearProductSelection();
            } catch (error) {
                MessageBox.error(this._getErrorMessage(error));
            }
        },

        onGetStock: async function () {

            const oItem = this.oSelectedProduct || this.byId("productsTable").getSelectedItem();

            if (!oItem) {
                MessageToast.show("Please select a product first.");
                return;
            }

            const sID = oItem.getBindingContext("local").getProperty("ID");

            try {
                const result = await this._callAction("getProductStock", { ID: sID });
                const stock = (result && typeof result === "object" && result.value !== undefined)
                    ? result.value
                    : result;

                MessageBox.information("Current stock quantity: " + stock);
            } catch (error) {
                MessageBox.error(this._getErrorMessage(error));
            }
        },


        // =========================================================
        // COMPLETE / CANCEL SALE (Sales tab)
        // =========================================================

        onCompleteSale: async function () {

            const oItem = this.oSelectedSale || this.byId("salesTable").getSelectedItem();

            if (!oItem) {
                MessageToast.show("Please select a sale first.");
                return;
            }

            const sID = oItem.getBindingContext("local").getProperty("ID");

            try {
                await this._callAction("completeSale", { ID: sID });
                MessageToast.show("Sale completed successfully.");
                await this._loadSales();
                this._clearSaleSelection();
            } catch (error) {
                MessageBox.error(this._getErrorMessage(error));
            }
        },

        onCancelSale: async function () {

            const oItem = this.oSelectedSale || this.byId("salesTable").getSelectedItem();

            if (!oItem) {
                MessageToast.show("Please select a sale first.");
                return;
            }

            const sID = oItem.getBindingContext("local").getProperty("ID");

            try {
                await this._callAction("cancelSale", { ID: sID });
                MessageToast.show("Sale cancelled successfully.");
                await this._loadSales();
                this._clearSaleSelection();
            } catch (error) {
                MessageBox.error(this._getErrorMessage(error));
            }
        },

        onNewSale: function () {
            MessageToast.show("New Sale functionality can be added next.");
        },


        // =========================================================
        // REFRESH PRODUCTS + SALES
        // =========================================================

        onRefresh: async function () {

            try {
                await Promise.all([this._loadProducts(), this._loadSales()]);
                this._clearProductSelection();
                this._clearSaleSelection();
                MessageToast.show("Products and Sales refreshed successfully.");
            } catch (error) {
                console.error(error);
            }
        },


        // =========================================================
        // GENERIC ACTION CALL (REST-style, used by Products/Sales)
        // =========================================================

        _callAction: async function (sAction, oPayload) {

            const response = await fetch("/odata/v4/sales-inventory/" + sAction, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(oPayload)
            });

            if (!response.ok) {

                let errorMessage = "Action failed: " + response.status;

                try {
                    const errorData = await response.json();
                    if (errorData && errorData.error && errorData.error.message) {
                        errorMessage = errorData.error.message;
                    }
                } catch (e) {
                    // Ignore JSON parsing error
                }

                throw new Error(errorMessage);
            }

            const text = await response.text();

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
        // INVENTORY: look up product name from the already-loaded
        // Products list, matched on the plain product_ID foreign key
        // (avoids needing a second $expand on the Inventory binding)
        // =========================================================

        getProductName: function (sProductId) {

            if (!sProductId) {
                return "";
            }

            const aProducts = (this.oLocalModel && this.oLocalModel.getProperty("/products")) || [];
            const oProduct = aProducts.find(function (oP) {
                return oP.ID === sProductId;
            });

            return oProduct ? oProduct.productName : sProductId;
        },


        // =========================================================
        // INVENTORY: model helpers
        // =========================================================

        _getInventoryModel: function () {
            return this.getView().getModel("inventory");
        },

        _showError: function (oError) {
            MessageBox.error(this._getErrorMessage(oError));
        },

        _callInventoryAction: async function (sActionName, mParams) {

            const oModel = this._getInventoryModel();

            if (!oModel) {
                const oError = new Error(
                    "Inventory OData model is not available. Please check manifest.json."
                );
                this._showError(oError);
                throw oError;
            }

            try {

                const oAction = oModel.bindContext("/" + sActionName + "(...)");

                Object.keys(mParams || {}).forEach(function (sKey) {
                    oAction.setParameter(sKey, mParams[sKey]);
                });

                const result = await oAction.execute();

                MessageToast.show(sActionName + " successful");

                const oTable = this.byId("inventoryTable");
                const oBinding = oTable && oTable.getBinding("items");
                if (oBinding) {
                    oBinding.refresh();
                }

                return result;

            } catch (oError) {
                console.error("Inventory action error:", oError);
                this._showError(oError);
                throw oError;
            }
        },


        // =========================================================
        // INVENTORY: refresh
        // =========================================================

        onRefreshInventory: function () {

            const oTable = this.byId("inventoryTable");

            if (!oTable) {
                MessageBox.error("Inventory table not found.");
                return;
            }

            const oBinding = oTable.getBinding("items");

            if (!oBinding) {
                MessageBox.warning("Inventory binding is not available.");
                return;
            }

            oBinding.refresh();
            MessageToast.show("Inventory refreshed successfully.");
        },


        // =========================================================
        // INVENTORY: get the row context reliably regardless of
        // exact control nesting (e.g. click from a MenuItem nested
        // inside a MenuButton inside a ColumnListItem)
        // =========================================================

        _getRowContext: function (oEvent) {

            let oControl = oEvent.getSource();

            while (oControl) {
                const oContext = oControl.getBindingContext("inventory");
                if (oContext) {
                    return oContext;
                }
                oControl = oControl.getParent();
            }

            return null;
        },


        // =========================================================
        // INVENTORY: quantity dialog (shared by Adjust / Reserve / Release)
        // =========================================================

        _openQtyDialog: function (sTitle, sActionName, sInventoryID) {

            if (!sInventoryID) {
                MessageBox.error("Inventory ID is missing. Cannot proceed.");
                return;
            }

            const oInput = new Input({
                type: "Number",
                placeholder: "Enter quantity",
                width: "100%"
            });

            const oDialog = new Dialog({
                title: sTitle,
                contentWidth: "20rem",

                content: new VBox({
                    items: [new Label({ text: "Quantity" }), oInput]
                }).addStyleClass("sapUiSmallMargin"),

                beginButton: new Button({
                    text: "Submit",
                    type: "Emphasized",
                    press: async () => {

                        const iQuantity = parseInt(oInput.getValue(), 10);

                        if (!Number.isInteger(iQuantity) || iQuantity <= 0) {
                            MessageBox.warning("Please enter a valid quantity greater than zero.");
                            return;
                        }

                        try {
                            await this._callInventoryAction(sActionName, {
                                inventoryID: sInventoryID,
                                quantity: iQuantity
                            });
                            oDialog.close();
                        } catch (error) {
                            // Error already shown by _callInventoryAction via _showError
                        }
                    }
                }),

                endButton: new Button({
                    text: "Cancel",
                    press: function () {
                        oDialog.close();
                    }
                }),

                afterClose: function () {
                    oDialog.destroy();
                }
            });

            this.getView().addDependent(oDialog);
            oDialog.open();
        },

        onAdjustStock: function (oEvent) {

            const oContext = this._getRowContext(oEvent);

            if (!oContext) {
                MessageBox.error("Could not find the selected inventory row.");
                return;
            }

            this._openQtyDialog("Adjust Stock", "adjustStock", oContext.getProperty("ID"));
        },

        onReserveStock: function (oEvent) {

            const oContext = this._getRowContext(oEvent);

            if (!oContext) {
                MessageBox.error("Could not find the selected inventory row.");
                return;
            }

            this._openQtyDialog("Reserve Stock", "reserveStock", oContext.getProperty("ID"));
        },

        onReleaseStock: function (oEvent) {

            const oContext = this._getRowContext(oEvent);

            if (!oContext) {
                MessageBox.error("Could not find the selected inventory row.");
                return;
            }

            this._openQtyDialog("Release Stock", "releaseStock", oContext.getProperty("ID"));
        },


        // =========================================================
        // CLEAR SELECTIONS
        // =========================================================

        _clearProductSelection: function () {
            this.oSelectedProduct = null;
            const oTable = this.byId("productsTable");
            if (oTable) {
                oTable.removeSelections(true);
            }
        },

        _clearSaleSelection: function () {
            this.oSelectedSale = null;
            const oTable = this.byId("salesTable");
            if (oTable) {
                oTable.removeSelections(true);
            }
        },


        // =========================================================
        // ERROR MESSAGE
        // =========================================================

        _getErrorMessage: function (error) {

            if (!error) {
                return "Unknown error occurred.";
            }

            if (error.message) {
                return error.message;
            }

            return String(error);
        }

    });
});