
export interface FoodItem {
  id: string;
  name: string;
  price: number;
}

export interface OrderItem {
  foodId: string;
  quantity: number;
}

export interface Order {
  id: string;
  customerName: string;
  items: OrderItem[];
  orderDate: string;
}

export type ViewType = 'dashboard' | 'food-management' | 'order-management';
