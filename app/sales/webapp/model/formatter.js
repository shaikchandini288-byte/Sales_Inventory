sap.ui.define([
	"sap/ui/base/ManagedObject"
], function(
	ManagedObject
) {
	"use strict";

	var Formatter = ManagedObject.extend("sales.model.formatter", {
	});

	// Static methods go directly on the class, not inside extend({...}),
	// so that "formatter.formatDateTime" resolves without needing an instance.
	Formatter.formatDateTime = function (sDateTime) {

		if (!sDateTime) {
			return "";
		}

		var oDate = new Date(sDateTime);

		return oDate.toLocaleString();
	};

	return Formatter;
});