sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel"
], (Controller, JSONModel) => {
    "use strict";

    return Controller.extend("ui5display.controller.App", {
        onInit() {
            this.dataModel = new JSONModel([]);
            this.getView().setModel(this.dataModel, "dataModel");
            // this.getView().setModel(this.getOwnerComponent().getModel(), "");
            this.getOwnerComponent().getModel().read("/Books", {
                success: data => {
                    this.dataModel.setData(data.results);
                },
                error: console.error
            });
        }
    });
});