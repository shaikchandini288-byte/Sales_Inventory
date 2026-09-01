using { sales.inventory as db } from '../db/schema';

@path: 'sales-inventory'
service MyService {

    // =================================================
    // PRODUCTS
    // =================================================

    @readonly
    entity Products as projection on db.Products;

    // =================================================
    // CATEGORIES
    // =================================================

    @readonly
    entity Categories as projection on db.Categories;

    // =================================================
    // CUSTOMERS
    // =================================================

    @readonly
    entity Customers as projection on db.Customers;

    // =================================================
    // SALES
    // =================================================

    entity Sales as projection on db.Sales;


    // =================================================
    // PRODUCT ACTIONS
    // =================================================

    action activateProduct(
        ID : UUID
    ) returns Products;

    action deactivateProduct(
        ID : UUID
    ) returns Products;

    action getProductStock(
        ID : UUID
    ) returns Decimal(15,2);


    // =================================================
    // SALES ACTIONS
    // =================================================

    action completeSale(
        ID : UUID
    ) returns Sales;

    action cancelSale(
        ID : UUID
    ) returns Sales;

    action getTotalSales()
        returns Decimal(15,2);
}