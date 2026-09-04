sap.ui.define([
	"sap/ui/base/ManagedObject"
], function(
	ManagedObject
) {
	"use strict";

	var Formatter = ManagedObject.extend("sales.model.formatter", {
	});

	// Static methods go directly on the class, not inside extend({...}),
	// so that "formatter.xxx" resolves without needing an instance.

	Formatter.formatDateTime = function (sDateTime) {

		if (!sDateTime) {
			return "";
		}

		var oDate = new Date(sDateTime);

		return oDate.toLocaleString();
	};

	Formatter.formatDate = function (sDate) {

		if (!sDate) {
			return "";
		}

		var oDate = new Date(sDate);

		if (isNaN(oDate.getTime())) {
			return String(sDate);
		}

		return oDate.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric"
		});
	};

	Formatter.statusState = function (sStatus) {

		switch (sStatus) {
			case "Completed":
				return "Success";
			case "Pending":
				return "Warning";
			case "In Progress":
				return "Information";
			case "Cancelled":
				return "Error";
			default:
				return "None";
		}
	};

	return Formatter;
});