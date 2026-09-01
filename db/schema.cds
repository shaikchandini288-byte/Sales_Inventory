namespace sales.inventory;

using { cuid, managed } from '@sap/cds/common';

namespace salesinventory;
 
using { cuid} from '@sap/cds/common';
 
 
// =====================================================
// CATEGORIES
// =====================================================

entity Categories : cuid, managed {

    categoryName : String(100) not null;
    description  : String(255);

    products : Association to many Products
        on products.category = $self;
}


// =====================================================
// PRODUCTS
// =====================================================

entity Products : cuid, managed {

    productCode : String(50) not null;
    productName : String(150) not null;
    description : String(255);

    category : Association to Categories;

    unitPrice : Decimal(15,2);
    stockQty  : Decimal(15,2);

    status : String(20) default 'ACTIVE';

    sales : Association to many Sales
        on sales.product = $self;
}


// =====================================================
// CUSTOMERS
// =====================================================

entity Customers : cuid, managed {

    customerCode : String(50) not null;
    customerName : String(150) not null;

    email   : String(150);
    phone   : String(30);
    address : String(255);

    sales : Association to many Sales
        on sales.customer = $self;
}


// =====================================================
// SALES
// =====================================================

entity Sales : cuid, managed {

    saleNumber : String(50) not null;

    customer : Association to Customers;

    product : Association to Products;

    quantity : Decimal(15,2);

    unitPrice : Decimal(15,2);

    totalAmount : Decimal(15,2);

    saleDate : DateTime;

    status : String(20) default 'CREATED';

    remarks : String(255);
 
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



