
import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Utensils, 
  Users, 
  LayoutDashboard, 
  Plus, 
  Trash2, 
  Edit2,
  X,
  Download, 
  Upload,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Minus,
  ShoppingCart,
  Search,
  ClipboardList,
  Database,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { FoodItem, Order, OrderItem, ViewType } from './types';
import { exportToExcel, parseExcelData } from './services/excelService';
import { db } from './services/db';

const LOCAL_STORAGE_KEY = 'food_order_app_db_v5';
const ORDERS_PER_PAGE = 5;

export default function App() {
  const [view, setView] = useState<ViewType>('dashboard');
  
  // Database Queries (Reactive - tự động cập nhật khi DB thay đổi)
  const foods = useLiveQuery(() => db.foods.toArray()) || [];
  const orders = useLiveQuery(() => db.orders.orderBy('orderDate').reverse().toArray()) || [];
  
  const [searchTerm, setSearchTerm] = useState('');
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  
  // Form states
  const [foodForm, setFoodForm] = useState({ name: '', price: '' });
  const [orderCustomerName, setOrderCustomerName] = useState('');
  const [draftQuantities, setDraftQuantities] = useState<Record<string, number>>({});
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  // Pagination state
  const [orderCurrentPage, setOrderCurrentPage] = useState(1);

  // MIGRATION: Chuyển dữ liệu từ LocalStorage sang IndexedDB trong lần đầu sử dụng
  useEffect(() => {
    const migrateData = async () => {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        try {
          const { foods: sFoods, orders: sOrders } = JSON.parse(saved);
          
          // Chỉ migrate nếu Database đang trống
          const foodCount = await db.foods.count();
          if (foodCount === 0) {
            if (sFoods?.length) await db.foods.bulkAdd(sFoods);
            if (sOrders?.length) await db.orders.bulkAdd(sOrders);
            console.log("Đã chuyển đổi dữ liệu từ LocalStorage sang Database thành công!");
          }
          // Sau khi migrate xong hoặc nếu đã có data, ta có thể xóa LS để giải phóng bộ nhớ (tùy chọn)
          // localStorage.removeItem(LOCAL_STORAGE_KEY);
        } catch (e) {
          console.error("Lỗi khi migrate dữ liệu", e);
        }
      }
    };
    migrateData();
  }, []);

  // Handle Excel Import
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const buffer = evt.target?.result;
        const { foods: newFoods, orders: newOrders } = await parseExcelData(buffer);
        
        if (confirm(`Nạp dữ liệu từ Excel? (Dữ liệu hiện tại trong Database sẽ bị thay thế)`)) {
          await db.transaction('rw', db.foods, db.orders, async () => {
            await db.foods.clear();
            await db.orders.clear();
            await db.foods.bulkAdd(newFoods);
            await db.orders.bulkAdd(newOrders);
          });
          alert("Nạp dữ liệu thành công!");
        }
      } catch (err) {
        alert("Lỗi: File Excel không đúng định dạng.");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ''; 
  };

  // Food Actions
  const addFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foodForm.name || !foodForm.price) return;
    const newFood: FoodItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: foodForm.name,
      price: parseFloat(foodForm.price)
    };
    await db.foods.add(newFood);
    setFoodForm({ name: '', price: '' });
  };

  const removeFood = async (id: string) => {
    if (confirm("Xóa món ăn này khỏi thực đơn?")) {
      await db.foods.delete(id);
    }
  };

  // Order Actions
  const updateDraftQuantity = (foodId: string, delta: number) => {
    setDraftQuantities(prev => ({
      ...prev,
      [foodId]: Math.max(0, (prev[foodId] || 0) + delta)
    }));
  };

  const startEditOrder = (order: Order) => {
    setEditingOrderId(order.id);
    setOrderCustomerName(order.customerName);
    const newDraft: Record<string, number> = {};
    order.items.forEach(item => { newDraft[item.foodId] = item.quantity; });
    setDraftQuantities(newDraft);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingOrderId(null);
    setOrderCustomerName('');
    setDraftQuantities({});
  };

  const saveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const items: OrderItem[] = (Object.entries(draftQuantities) as [string, number][])
      .filter(([_, qty]) => qty > 0)
      .map(([foodId, quantity]) => ({ foodId, quantity }));

    if (!orderCustomerName || items.length === 0) {
      alert("Vui lòng điền đủ tên khách và chọn món.");
      return;
    }

    if (editingOrderId) {
      await db.orders.update(editingOrderId, { customerName: orderCustomerName, items });
      setEditingOrderId(null);
    } else {
      const newOrder: Order = {
        id: Math.random().toString(36).substr(2, 9),
        customerName: orderCustomerName,
        items,
        orderDate: new Date().toLocaleString('vi-VN')
      };
      await db.orders.add(newOrder);
    }
    setOrderCustomerName('');
    setDraftQuantities({});
  };

  const removeOrder = async (id: string) => {
    if (confirm("Xóa đơn hàng này?")) {
      await db.orders.delete(id);
      if (editingOrderId === id) cancelEdit();
    }
  };

  // Calculations
  const getOrderTotal = (order: Order) => {
    return order.items.reduce((sum, item) => {
      const food = foods.find(f => f.id === item.foodId);
      return sum + (food ? food.price * item.quantity : 0);
    }, 0);
  };

  const totalRevenue = orders.reduce((sum, order) => sum + getOrderTotal(order), 0);
  
  // Filtering & Pagination
  const filteredFoods = foods.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredOrdersList = useMemo(() => {
    return orderSearchTerm ? orders.filter(o => o.customerName.toLowerCase().includes(orderSearchTerm.toLowerCase())) : orders;
  }, [orders, orderSearchTerm]);

  const totalOrderPages = Math.ceil(filteredOrdersList.length / ORDERS_PER_PAGE);
  const paginatedOrders = filteredOrdersList.slice((orderCurrentPage - 1) * ORDERS_PER_PAGE, orderCurrentPage * ORDERS_PER_PAGE);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50">
      {/* Sidebar */}
      <nav className="w-full md:w-64 bg-white border-r border-slate-200 p-6 flex flex-col gap-8 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 p-2 rounded-xl text-white shadow-lg shadow-emerald-100">
            <Utensils size={24} />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            FoodOrder Pro
          </h1>
        </div>

        <div className="flex flex-col gap-1">
          <SidebarLink active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<LayoutDashboard size={20}/>} label="Tổng quan" />
          <SidebarLink active={view === 'food-management'} onClick={() => setView('food-management')} icon={<Utensils size={20}/>} label="Thực đơn" />
          <SidebarLink active={view === 'order-management'} onClick={() => setView('order-management')} icon={<Users size={20}/>} label="Đặt món" />
        </div>

        {/* Database Management Section */}
        <div className="mt-auto p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <Database size={12} /> CƠ SỞ DỮ LIỆU (SQL)
          </h4>
          
          <div className="space-y-2">
            <button 
              onClick={() => exportToExcel(foods, orders)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-xl hover:bg-slate-100 transition-all shadow-sm"
            >
              <Download size={14} className="text-emerald-500" /> Xuất file Excel
            </button>
            
            <label className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-xl hover:bg-slate-100 transition-all shadow-sm cursor-pointer">
              <Upload size={14} className="text-blue-500" /> Nhập từ Excel
              <input type="file" accept=".xlsx" className="hidden" onChange={handleImportExcel} />
            </label>
          </div>

          <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
            <div className="flex items-center gap-2 text-[10px] text-emerald-700 font-bold mb-1">
              <RefreshCw size={10} className="animate-spin-slow" /> DATABASE ACTIVE
            </div>
            <p className="text-[9px] text-emerald-600 leading-tight">Dữ liệu được quản lý bởi IndexedDB công nghệ cao.</p>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto max-h-screen">
        {view === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <header>
              <h2 className="text-3xl font-bold text-slate-800">Thống kê chung</h2>
              <p className="text-slate-500">Toàn bộ dữ liệu được lưu trữ trong Database trình duyệt.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard title="Doanh thu" value={`${totalRevenue.toLocaleString()}đ`} icon={<DollarSign className="text-emerald-500" />} color="bg-emerald-50" />
              <StatCard title="Tổng đơn" value={orders.length.toString()} icon={<ShoppingBag className="text-blue-500" />} color="bg-blue-50" />
              <StatCard title="Món ăn" value={foods.length.toString()} icon={<Utensils className="text-orange-500" />} color="bg-orange-50" />
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h3 className="font-bold text-lg">Hoạt động gần đây</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                    <tr>
                      <th className="px-6 py-4">Khách hàng</th>
                      <th className="px-6 py-4">Sản phẩm</th>
                      <th className="px-6 py-4 text-right">Tổng cộng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.slice(0, 5).map(order => (
                      <tr key={order.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="font-bold">{order.customerName}</div>
                          <div className="text-[10px] text-slate-400">{order.orderDate}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {order.items.map((it, idx) => (
                              <span key={idx} className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                {foods.find(f => f.id === it.foodId)?.name} x{it.quantity}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-black text-emerald-600">
                          {getOrderTotal(order).toLocaleString()}đ
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {view === 'food-management' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4">
            <header>
              <h2 className="text-3xl font-bold text-slate-800">Quản lý Thực đơn</h2>
            </header>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2"><Plus size={18} /> Thêm món</h3>
                <form onSubmit={addFood} className="space-y-4">
                  <FormField label="Tên món" value={foodForm.name} onChange={v => setFoodForm({...foodForm, name: v})} placeholder="Phở bò..." />
                  <FormField label="Giá bán" type="number" value={foodForm.price} onChange={v => setFoodForm({...foodForm, price: v})} placeholder="45000" />
                  <button className="w-full py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-all">Lưu món ăn</button>
                </form>
              </div>
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input type="text" placeholder="Tìm tên món..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm outline-none" />
                  </div>
                </div>
                <table className="w-full">
                  <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400">
                    <tr>
                      <th className="px-6 py-3 text-left">Tên món</th>
                      <th className="px-6 py-3 text-right">Giá</th>
                      <th className="px-6 py-3 text-center w-16">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredFoods.map(f => (
                      <tr key={f.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-bold">{f.name}</td>
                        <td className="px-6 py-4 text-right font-mono text-emerald-600">{f.price.toLocaleString()}đ</td>
                        <td className="px-6 py-4 text-center">
                          <button onClick={() => removeFood(f.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {view === 'order-management' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4">
             <header>
              <h2 className="text-3xl font-bold text-slate-800">Đặt món & Quản lý đơn</h2>
            </header>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              {/* Form Order */}
              <div className="lg:col-span-3 space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <FormField label="Tên khách hàng" value={orderCustomerName} onChange={setOrderCustomerName} placeholder="Nhập tên..." />
                    <div className="relative pt-6">
                      <Search className="absolute left-3 top-[70%] -translate-y-1/2 text-slate-400" size={16} />
                      <input type="text" placeholder="Tìm món nhanh..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {filteredFoods.map(f => {
                      const qty = draftQuantities[f.id] || 0;
                      return (
                        <div key={f.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${qty > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100'}`}>
                          <div className="font-bold text-sm">{f.name} <span className="block text-xs font-medium text-emerald-600">{f.price.toLocaleString()}đ</span></div>
                          <div className="flex items-center gap-3">
                            <button onClick={() => updateDraftQuantity(f.id, -1)} className="p-1 border rounded-lg hover:bg-white"><Minus size={14}/></button>
                            <span className="w-6 text-center font-bold text-sm">{qty}</span>
                            <button onClick={() => updateDraftQuantity(f.id, 1)} className="p-1 border rounded-lg hover:bg-white"><Plus size={14}/></button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Order Summary & List */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
                  {editingOrderId && <div className="absolute top-0 right-0 bg-amber-500 text-slate-900 text-[9px] font-black px-3 py-1 rounded-bl-lg">ĐANG SỬA</div>}
                  <h3 className="font-bold mb-4 flex items-center gap-2"><ShoppingCart size={18} className="text-emerald-400" /> Xác nhận đơn</h3>
                  <div className="space-y-2 mb-6 min-h-[100px] max-h-[200px] overflow-y-auto custom-scrollbar-dark pr-2">
                    {(Object.entries(draftQuantities) as [string, number][]).map(([id, qty]) => qty > 0 && (
                      <div key={id} className="flex justify-between text-xs border-b border-slate-800 pb-2">
                        <span>{foods.find(f => f.id === id)?.name} x{qty}</span>
                        <span className="font-bold text-emerald-400">{( (foods.find(f => f.id === id)?.price || 0) * qty).toLocaleString()}đ</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-slate-400 text-sm">Tổng thanh toán:</span>
                    <span className="text-2xl font-black text-emerald-400">{draftTotal(draftQuantities, foods).toLocaleString()}đ</span>
                  </div>
                  <div className="flex gap-2">
                    {editingOrderId && <button onClick={cancelEdit} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 font-bold rounded-xl text-xs">HỦY</button>}
                    <button onClick={saveOrder} className={`flex-[2] py-3 font-bold rounded-xl text-xs transition-all ${editingOrderId ? 'bg-amber-500 text-slate-900' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}>
                      {editingOrderId ? 'CẬP NHẬT ĐƠN' : 'LƯU ĐƠN HÀNG'}
                    </button>
                  </div>
                </div>

                {/* Paginated Order List */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[500px]">
                  <div className="p-4 bg-slate-50 border-b border-slate-100 space-y-3">
                    <h4 className="text-xs font-bold text-slate-700 flex items-center gap-2"><ClipboardList size={14} /> Đơn đặt hàng</h4>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input type="text" placeholder="Tìm khách..." value={orderSearchTerm} onChange={e => setOrderSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-emerald-500" />
                    </div>
                  </div>
                  <div className="overflow-y-auto flex-1 divide-y divide-slate-100 custom-scrollbar">
                    {paginatedOrders.map(o => (
                      <div key={o.id} className={`p-4 hover:bg-slate-50 group relative border-l-4 ${editingOrderId === o.id ? 'border-amber-500 bg-amber-50/20' : 'border-transparent hover:border-emerald-500'}`}>
                        <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => startEditOrder(o)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded"><Edit2 size={12}/></button>
                          <button onClick={() => removeOrder(o.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"><Trash2 size={12}/></button>
                        </div>
                        <div className="flex justify-between mb-2 pr-12">
                          <div className="font-bold text-xs truncate max-w-[120px]">{o.customerName}</div>
                          <div className="text-[10px] font-black text-emerald-600">{getOrderTotal(o).toLocaleString()}đ</div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {o.items.map((it, idx) => (
                             <span key={idx} className="text-[9px] bg-slate-50 border border-slate-100 px-1 py-0.5 rounded text-slate-500">
                               {foods.find(f => f.id === it.foodId)?.name} x{it.quantity}
                             </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {filteredOrdersList.length === 0 && <div className="p-8 text-center text-slate-300 text-xs italic">Chưa có đơn hàng.</div>}
                  </div>
                  {/* Pagination */}
                  {totalOrderPages > 1 && (
                    <div className="p-2 border-t border-slate-100 flex items-center justify-between bg-slate-50">
                      <button disabled={orderCurrentPage === 1} onClick={() => setOrderCurrentPage(p => p - 1)} className="p-1 disabled:opacity-30"><ChevronLeft size={16}/></button>
                      <span className="text-[10px] font-bold text-slate-400">Trang {orderCurrentPage}/{totalOrderPages}</span>
                      <button disabled={orderCurrentPage === totalOrderPages} onClick={() => setOrderCurrentPage(p => p + 1)} className="p-1 disabled:opacity-30"><ChevronRight size={16}/></button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Helpers
const draftTotal = (draft: Record<string, number>, foods: FoodItem[]) => 
  (Object.entries(draft) as [string, number][]).reduce((sum, [id, qty]) => sum + (foods.find(f => f.id === id)?.price || 0) * qty, 0);

const SidebarLink = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button onClick={onClick} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-emerald-50 text-emerald-600 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>{icon} {label}</button>
);

const FormField = ({ label, value, onChange, placeholder, type = "text" }: { label: string, value: any, onChange: (v: any) => void, placeholder: string, type?: string }) => (
  <div>
    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm" />
  </div>
);

const StatCard = ({ title, value, icon, color }: { title: string, value: string, icon: React.ReactNode, color: string }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-6">
    <div className={`p-4 rounded-2xl ${color} shadow-sm`}>{icon}</div>
    <div>
      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</div>
      <div className="text-2xl font-black text-slate-800 tracking-tight">{value}</div>
    </div>
  </div>
);
