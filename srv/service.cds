using{salesinventory as db} from '../db/schema';

service MyService {
    entity Categories as projection on db.Categories;

    

}