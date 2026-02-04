
import Dexie, { type EntityTable } from 'dexie';
import { FoodItem, Order } from '../types';

// Định nghĩa Database
const db = new Dexie('FoodOrderDB') as Dexie & {
  foods: EntityTable<FoodItem, 'id'>;
  orders: EntityTable<Order, 'id'>;
};

// Cấu trúc bảng: 
// foods: id (khóa chính), name (để tìm kiếm nhanh)
// orders: id (khóa chính), customerName, orderDate (để tìm kiếm/sắp xếp)
db.version(1).stores({
  foods: 'id, name',
  orders: 'id, customerName, orderDate'
});

export { db };
