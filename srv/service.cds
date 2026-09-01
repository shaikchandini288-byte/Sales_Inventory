using{salesinventory as db} from '../db/schema';

service MyService {
    entity Categories as projection on db.Categories;

    

}

service MyService1 {
    entity Inventory as projection on db.Inventory;
    entity Warehouses as projection on db.Warehouses;
    action adjustStock(inventoryID:UUID,quantity:Integer) returns  String;
    action reserveStock(inventoryID:UUID,quantity:Integer) returns  String;
    action releaseStock(inventoryID:UUID,quantity:Integer) returns  String;


    

}