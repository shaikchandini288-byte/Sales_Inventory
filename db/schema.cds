namespace salesinventory;
 
using { cuid, managed } from '@sap/cds/common';
 
 
// =====================================================
// PART 1 — Products & Categories
// =====================================================
 
entity Categories : cuid, managed {
 
    name : String(50) not null;
 
}