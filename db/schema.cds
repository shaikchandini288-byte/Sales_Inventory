namespace salesinventory;
 
using { cuid} from '@sap/cds/common';
 
 
// =====================================================
// PART 1 — Products & Categories
// =====================================================
 
entity Categories : cuid {
 
    name : String(50) not null;
 
}

entity Inventory :cuid{
    stockQty:Integer;
    reservedQty:Integer;
    lastUpdated:DateTime;
    warehouse:Association to Warehouses; //201
    //product:Association to Products;
}


entity Warehouses: cuid{
    warehouseCode:String;
    warehouseName:String;
    location:String;
    status:String;
    inventory: Association to many Inventory on inventory.warehouse=$self;
}



