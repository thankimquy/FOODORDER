
import * as XLSX from 'xlsx';
import { FoodItem, Order } from '../types';

export const generateExcelBuffer = (foods: FoodItem[], orders: Order[]): ArrayBuffer => {
  const workbook = XLSX.utils.book_new();

  // Prepare Food Data
  const foodData = foods.map(f => ({
    'Mã món': f.id,
    'Tên món ăn': f.name,
    'Giá (VNĐ)': f.price
  }));
  const foodSheet = XLSX.utils.json_to_sheet(foodData);
  XLSX.utils.book_append_sheet(workbook, foodSheet, 'Thực đơn');

  // Prepare Order Data
  const flattenedOrders: any[] = [];
  orders.forEach(o => {
    o.items.forEach(item => {
      const food = foods.find(f => f.id === item.foodId);
      flattenedOrders.push({
        'Mã đơn hàng': o.id,
        'Tên khách hàng': o.customerName,
        'Món ăn': food ? food.name : 'Đã xóa',
        'Đơn giá': food ? food.price : 0,
        'Số lượng': item.quantity,
        'Thành tiền': (food ? food.price : 0) * item.quantity,
        'Ngày đặt': o.orderDate
      });
    });
  });
  
  const orderSheet = XLSX.utils.json_to_sheet(flattenedOrders);
  XLSX.utils.book_append_sheet(workbook, orderSheet, 'Danh sách đặt hàng');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return excelBuffer;
};

export const parseExcelData = async (data: any): Promise<{ foods: FoodItem[], orders: Order[] }> => {
  const workbook = XLSX.read(data, { type: 'array' });
  
  // Import Foods
  const foodSheet = workbook.Sheets['Thực đơn'];
  const importedFoodsRaw: any[] = foodSheet ? XLSX.utils.sheet_to_json(foodSheet) : [];
  const foods: FoodItem[] = importedFoodsRaw.map(item => ({
    id: String(item['Mã món'] || Math.random().toString(36).substr(2, 9)),
    name: String(item['Tên món ăn'] || 'Không tên'),
    price: Number(item['Giá (VNĐ)']) || 0
  }));

  // Import Orders
  const orderSheet = workbook.Sheets['Danh sách đặt hàng'];
  const importedOrdersRaw: any[] = orderSheet ? XLSX.utils.sheet_to_json(orderSheet) : [];
  
  const ordersMap = new Map<string, Order>();
  
  importedOrdersRaw.forEach(item => {
    const orderId = String(item['Mã đơn hàng'] || (item['Tên khách hàng'] + item['Ngày đặt']));
    const foodName = String(item['Món ăn']);
    const matchedFood = foods.find(f => f.name === foodName);
    
    if (!ordersMap.has(orderId)) {
      ordersMap.set(orderId, {
        id: orderId,
        customerName: String(item['Tên khách hàng'] || 'Khách ẩn danh'),
        orderDate: String(item['Ngày đặt'] || new Date().toLocaleString('vi-VN')),
        items: []
      });
    }
    
    if (matchedFood) {
      ordersMap.get(orderId)?.items.push({
        foodId: matchedFood.id,
        quantity: Number(item['Số lượng']) || 1
      });
    }
  });

  return { foods, orders: Array.from(ordersMap.values()) };
};

export const exportToExcel = (foods: FoodItem[], orders: Order[]) => {
  const buffer = generateExcelBuffer(foods, orders);
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `QuanLyDatMon_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};
