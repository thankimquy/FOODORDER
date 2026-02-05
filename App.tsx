
import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Utensils, 
  Users, 
  LayoutDashboard, 
  Plus, 
  Trash2, 
  Edit2,
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Minus,
  ShoppingCart,
  Search,
  ClipboardList,
  ChevronRight,
  ChevronLeft,
  PieChart,
  Award
} from 'lucide-react';
import { FoodItem, Order, OrderItem, ViewType } from './types';
import { db } from './services/db';

const ORDERS_PER_PAGE = 5;

export default function App() {
  const [view, setView] = useState<ViewType>('dashboard');
  
  // Database Queries
  const foods = useLiveQuery(() => db.foods.toArray()) || [];
  const orders = useLiveQuery(() => db.orders.orderBy('orderDate').reverse().toArray()) || [];
  
  const [searchTerm, setSearchTerm] = useState('');
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  
  // Form states
  const [foodForm, setFoodForm] = useState({ name: '', price: '' });
  const [orderCustomerName, setOrderCustomerName] = useState('');
  const [draftQuantities, setDraftQuantities] = useState<Record<string, number>>({});
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  // UI States
  const [orderCurrentPage, setOrderCurrentPage] = useState(1);

  // Actions
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
    if (confirm("Xóa món ăn này khỏi thực đơn?")) await db.foods.delete(id);
  };

  const updateDraftQuantity = (foodId: string, delta: number) => {
    setDraftQuantities(prev => ({
      ...prev,
      [foodId]: Math.max(0, (prev[foodId] || 0) + delta)
    }));
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

    if (!orderCustomerName || items.length === 0) return alert("Vui lòng nhập tên khách và chọn món.");

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
    if (confirm("Xóa đơn hàng này?")) await db.orders.delete(id);
  };

  // Calculations
  const getOrderTotal = (order: Order) => {
    return order.items.reduce((sum, item) => {
      const food = foods.find(f => f.id === item.foodId);
      return sum + (food ? food.price * item.quantity : 0);
    }, 0);
  };

  // Tính toán số lượng từng món đã bán
  const foodStats = useMemo(() => {
    const stats: Record<string, number> = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        stats[item.foodId] = (stats[item.foodId] || 0) + item.quantity;
      });
    });
    
    return foods.map(food => ({
      ...food,
      totalSold: stats[food.id] || 0
    })).sort((a, b) => b.totalSold - a.totalSold);
  }, [foods, orders]);

  const maxSold = Math.max(...foodStats.map(s => s.totalSold), 1);
  const totalRevenue = orders.reduce((sum, order) => sum + getOrderTotal(order), 0);
  
  const filteredFoods = foods.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredOrdersList = useMemo(() => {
    return orderSearchTerm ? orders.filter(o => o.customerName.toLowerCase().includes(orderSearchTerm.toLowerCase())) : orders;
  }, [orders, orderSearchTerm]);

  const totalOrderPages = Math.ceil(filteredOrdersList.length / ORDERS_PER_PAGE);
  const paginatedOrders = filteredOrdersList.slice((orderCurrentPage - 1) * ORDERS_PER_PAGE, orderCurrentPage * ORDERS_PER_PAGE);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 font-sans">
      {/* Sidebar */}
      <nav className="w-full md:w-72 bg-white border-r border-slate-200 p-6 flex flex-col gap-8 shadow-sm z-20">
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 p-2.5 rounded-xl text-white shadow-lg">
            <Utensils size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 leading-none">FoodOrder</h1>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Pro System</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <SidebarLink active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<LayoutDashboard size={18}/>} label="Tổng quan" />
          <SidebarLink active={view === 'food-management'} onClick={() => setView('food-management')} icon={<Utensils size={18}/>} label="Thực đơn" />
          <SidebarLink active={view === 'order-management'} onClick={() => setView('order-management')} icon={<Users size={18}/>} label="Đặt món" />
        </div>

        <div className="mt-auto pt-6 border-t border-slate-100">
           <div className="bg-slate-50 p-4 rounded-2xl">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Thông tin</p>
              <div className="text-[11px] text-slate-600 font-medium space-y-1">
                <p>Phiên bản: 2.0.0</p>
                <p>Dữ liệu: Local Database</p>
              </div>
           </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-12 overflow-y-auto max-h-screen">
        {view === 'dashboard' && (
          <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in slide-in-from-top-4 duration-700">
            <header>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight">Bảng điều khiển</h2>
                <p className="text-slate-500 font-medium">Theo dõi hiệu suất kinh doanh hôm nay.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <StatCard title="Doanh thu" value={`${totalRevenue.toLocaleString()}đ`} icon={<DollarSign className="text-emerald-600" />} color="bg-emerald-100" />
              <StatCard title="Đơn hàng" value={orders.length.toString()} icon={<ShoppingBag className="text-blue-600" />} color="bg-blue-100" />
              <StatCard title="Món trong thực đơn" value={foods.length.toString()} icon={<Utensils className="text-orange-600" />} color="bg-orange-100" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Thống kê số lượng từng món */}
              <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-black text-xl text-slate-800 flex items-center gap-2">
                    <PieChart size={20} className="text-indigo-500" /> Thống kê món ăn
                  </h3>
                  <Award size={20} className="text-amber-400" />
                </div>
                <div className="p-8 space-y-6 max-h-[450px] overflow-y-auto custom-scrollbar">
                  {foodStats.length > 0 ? (
                    foodStats.map(stat => (
                      <div key={stat.id} className="space-y-2">
                        <div className="flex justify-between items-end">
                          <span className="font-bold text-slate-700">{stat.name}</span>
                          <span className="text-xs font-black bg-slate-100 px-2 py-1 rounded-lg text-slate-900">{stat.totalSold} suất</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500 rounded-full transition-all duration-1000" 
                            style={{ width: `${(stat.totalSold / maxSold) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-10 text-center text-slate-300 italic font-medium">Chưa có dữ liệu bán hàng.</div>
                  )}
                </div>
              </div>

              {/* Giao dịch gần nhất */}
              <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-black text-xl text-slate-800 flex items-center gap-2">
                    <TrendingUp size={20} className="text-emerald-500" /> Đơn hàng mới nhất
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                      <tr>
                        <th className="px-8 py-5">Khách hàng</th>
                        <th className="px-8 py-5 text-right">Tổng tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.slice(0, 5).map(order => (
                        <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-5">
                            <div className="font-bold text-slate-800">{order.customerName}</div>
                            <div className="text-[10px] text-slate-400 font-medium">{order.orderDate}</div>
                          </td>
                          <td className="px-8 py-5 text-right font-black text-slate-900">
                            {getOrderTotal(order).toLocaleString()}đ
                          </td>
                        </tr>
                      ))}
                      {orders.length === 0 && (
                        <tr>
                          <td colSpan={2} className="py-20 text-center text-slate-300 italic">Chưa có giao dịch.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'food-management' && (
          <div className="max-w-6xl mx-auto space-y-10 animate-in slide-in-from-bottom-6 duration-500">
            <header>
              <h2 className="text-4xl font-black text-slate-900 tracking-tight">Quản lý thực đơn</h2>
              <p className="text-slate-500 font-medium">Thiết lập danh sách món ăn cho quán.</p>
            </header>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 h-fit sticky top-10">
                <h3 className="font-black text-xl mb-8 flex items-center gap-3 text-slate-800">
                  <div className="bg-slate-100 p-2 rounded-lg"><Plus size={20} /></div> 
                  Thêm món
                </h3>
                <form onSubmit={addFood} className="space-y-6">
                  <FormField label="Tên món" value={foodForm.name} onChange={v => setFoodForm({...foodForm, name: v})} placeholder="VD: Bún Chả..." />
                  <FormField label="Giá tiền" type="number" value={foodForm.price} onChange={v => setFoodForm({...foodForm, price: v})} placeholder="35000" />
                  <button className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all shadow-lg active:scale-95">Thêm vào thực đơn</button>
                </form>
              </div>
              <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type="text" placeholder="Tìm kiếm món ăn..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-6 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-medium outline-none transition-all focus:ring-4 focus:ring-slate-900/5" />
                  </div>
                </div>
                <div className="overflow-y-auto max-h-[600px] custom-scrollbar">
                  <table className="w-full">
                    <thead className="bg-slate-50 text-[11px] uppercase font-black text-slate-400 sticky top-0 border-b border-slate-100">
                      <tr>
                        <th className="px-8 py-4 text-left">Tên món</th>
                        <th className="px-8 py-4 text-right">Giá</th>
                        <th className="px-8 py-4 text-center w-24">Gỡ bỏ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredFoods.map(f => (
                        <tr key={f.id} className="hover:bg-slate-50/50 group">
                          <td className="px-8 py-5 font-bold text-slate-800">{f.name}</td>
                          <td className="px-8 py-5 text-right font-black text-slate-900">{f.price.toLocaleString()}đ</td>
                          <td className="px-8 py-5 text-center">
                            <button onClick={() => removeFood(f.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={18}/></button>
                          </td>
                        </tr>
                      ))}
                      {filteredFoods.length === 0 && <tr><td colSpan={3} className="py-20 text-center text-slate-300 font-medium italic">Không tìm thấy món ăn.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'order-management' && (
          <div className="max-w-6xl mx-auto space-y-10 animate-in slide-in-from-bottom-6 duration-500">
             <header>
              <h2 className="text-4xl font-black text-slate-900 tracking-tight">Khu vực đặt món</h2>
              <p className="text-slate-500 font-medium">Tiếp nhận đơn hàng từ khách hàng.</p>
            </header>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
              {/* Chọn món */}
              <div className="lg:col-span-3 space-y-6">
                <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <FormField label="Tên khách hàng" value={orderCustomerName} onChange={setOrderCustomerName} placeholder="Nhập tên khách..." />
                    <div className="relative pt-7">
                      <Search className="absolute left-4 top-[72%] -translate-y-1/2 text-slate-400" size={18} />
                      <input type="text" placeholder="Tìm món nhanh..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-6 py-3.5 rounded-2xl border border-slate-200 outline-none text-sm font-medium transition-all focus:ring-4 focus:ring-slate-900/5" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-2 custom-scrollbar">
                    {filteredFoods.map(f => {
                      const qty = draftQuantities[f.id] || 0;
                      return (
                        <div key={f.id} className={`group flex flex-col p-4 rounded-2xl border transition-all cursor-pointer select-none ${qty > 0 ? 'bg-slate-900 border-slate-900 shadow-lg text-white' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
                          <div className="flex justify-between items-start mb-4">
                            <div className="font-black leading-tight pr-2">{f.name}</div>
                            <div className={`font-black text-sm ${qty > 0 ? 'text-slate-300' : 'text-slate-600'}`}>{f.price.toLocaleString()}đ</div>
                          </div>
                          <div className="flex items-center justify-between mt-auto">
                            <div className="flex items-center gap-1">
                                <button onClick={(e) => { e.stopPropagation(); updateDraftQuantity(f.id, -1); }} className={`w-8 h-8 flex items-center justify-center rounded-lg shadow-sm ${qty > 0 ? 'bg-slate-800 border-slate-700' : 'bg-white border border-slate-200'}`}><Minus size={14}/></button>
                                <span className="w-8 text-center font-black text-sm">{qty}</span>
                                <button onClick={(e) => { e.stopPropagation(); updateDraftQuantity(f.id, 1); }} className={`w-8 h-8 flex items-center justify-center rounded-lg shadow-sm ${qty > 0 ? 'bg-slate-800 border-slate-700' : 'bg-white border border-slate-200'}`}><Plus size={14}/></button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Tóm tắt đơn hàng */}
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-2xl relative overflow-hidden ring-8 ring-slate-100">
                  {editingOrderId && <div className="absolute top-0 right-0 bg-amber-500 text-slate-900 text-[10px] font-black px-4 py-1.5 rounded-bl-xl">SỬA ĐƠN</div>}
                  <h3 className="font-black text-xl mb-6 flex items-center gap-3"><ShoppingCart size={22} className="text-slate-400" /> Thanh toán</h3>
                  
                  <div className="space-y-3 mb-8 min-h-[120px] max-h-[240px] overflow-y-auto custom-scrollbar-dark pr-3">
                    {/* Fix: Explicitly cast Object.entries to [string, number][] to avoid 'unknown' type for qty */}
                    {(Object.entries(draftQuantities) as [string, number][]).map(([id, qty]) => qty > 0 && (
                      <div key={id} className="flex justify-between items-center text-sm bg-slate-800/50 p-3 rounded-xl border border-slate-800">
                        <div className="flex flex-col">
                          <span className="font-bold">{foods.find(f => f.id === id)?.name}</span>
                          <span className="text-[10px] text-slate-500">Số lượng: {qty}</span>
                        </div>
                        {/* Fix: The explicit cast of entries above ensures qty is of type number for this arithmetic operation */}
                        <span className="font-black">{( (foods.find(f => f.id === id)?.price || 0) * qty).toLocaleString()}đ</span>
                      </div>
                    ))}
                    {Object.values(draftQuantities).every(q => q === 0) && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600 italic py-10">
                            <p className="text-xs">Giỏ hàng đang trống</p>
                        </div>
                    )}
                  </div>

                  <div className="flex justify-between items-end mb-8 border-t border-slate-800 pt-6">
                    <div className="text-slate-500 text-xs font-bold uppercase">Tổng:</div>
                    {/* Fix: Explicitly cast Object.entries to [string, number][] to avoid 'unknown' type for qty in reduce operation */}
                    <div className="text-4xl font-black text-white tracking-tighter">{((Object.entries(draftQuantities) as [string, number][]).reduce((sum, [id, qty]) => sum + (foods.find(f => f.id === id)?.price || 0) * qty, 0)).toLocaleString()}<span className="text-lg ml-1">đ</span></div>
                  </div>

                  <div className="flex gap-3">
                    {editingOrderId && <button onClick={cancelEdit} className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 font-black rounded-2xl text-xs uppercase transition-all">Hủy</button>}
                    <button onClick={saveOrder} className={`flex-[2] py-4 font-black rounded-2xl text-xs uppercase transition-all shadow-lg active:scale-95 ${editingOrderId ? 'bg-amber-500 text-slate-900' : 'bg-white text-slate-900 hover:bg-slate-100'}`}>
                      {editingOrderId ? 'Cập nhật' : 'Xác nhận đơn'}
                    </button>
                  </div>
                </div>

                {/* Danh sách chờ */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-[450px]">
                  <div className="p-6 bg-slate-50 border-b border-slate-100">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ClipboardList size={16} /> Lịch sử đơn</h4>
                  </div>
                  <div className="overflow-y-auto flex-1 divide-y divide-slate-100 custom-scrollbar">
                    {paginatedOrders.map(o => (
                      <div key={o.id} className="p-5 hover:bg-slate-50 transition-all group relative border-l-4 border-transparent hover:border-slate-900">
                        <div className="absolute right-3 top-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => { setEditingOrderId(o.id); setOrderCustomerName(o.customerName); const nd: Record<string, number> = {}; o.items.forEach(i => nd[i.foodId] = i.quantity); setDraftQuantities(nd); }} className="p-2 text-slate-600 hover:bg-white rounded-lg border border-slate-100"><Edit2 size={12}/></button>
                          <button onClick={() => removeOrder(o.id)} className="p-2 text-rose-600 hover:bg-white rounded-lg border border-slate-100"><Trash2 size={12}/></button>
                        </div>
                        <div className="flex justify-between mb-2">
                          <span className="font-black text-slate-800 text-sm">{o.customerName}</span>
                          <span className="text-xs font-black text-slate-900">{getOrderTotal(o).toLocaleString()}đ</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {o.items.map((it, idx) => (
                             <span key={idx} className="text-[9px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg text-slate-500 font-bold">
                               {foods.find(f => f.id === it.foodId)?.name} x{it.quantity}
                             </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {totalOrderPages > 1 && (
                    <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <button disabled={orderCurrentPage === 1} onClick={() => setOrderCurrentPage(p => p - 1)} className="p-2 bg-white border border-slate-200 rounded-lg disabled:opacity-30"><ChevronLeft size={16}/></button>
                      <span className="text-[10px] font-black text-slate-400">Trang {orderCurrentPage} / {totalOrderPages}</span>
                      <button disabled={orderCurrentPage === totalOrderPages} onClick={() => setOrderCurrentPage(p => p + 1)} className="p-2 bg-white border border-slate-200 rounded-lg disabled:opacity-30"><ChevronRight size={16}/></button>
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
const SidebarLink = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button onClick={onClick} className={`flex items-center gap-4 px-5 py-4 rounded-2xl transition-all ${active ? 'bg-slate-900 text-white font-black shadow-lg shadow-slate-200' : 'text-slate-500 hover:bg-slate-50 font-bold'}`}>
    {icon} 
    <span className="text-sm tracking-tight">{label}</span>
  </button>
);

const FormField = ({ label, value, onChange, placeholder, type = "text" }: { label: string, value: any, onChange: (v: any) => void, placeholder: string, type?: string }) => (
  <div className="w-full">
    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2.5">{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-slate-900/5 outline-none transition-all text-sm font-medium bg-slate-50/30 focus:bg-white" />
  </div>
);

const StatCard = ({ title, value, icon, color }: { title: string, value: string, icon: React.ReactNode, color: string }) => (
  <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 flex items-center gap-8 group hover:-translate-y-1 transition-all duration-300">
    <div className={`p-5 rounded-2xl ${color} shadow-inner group-hover:scale-110 transition-transform duration-500`}>{icon}</div>
    <div>
      <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{title}</div>
      <div className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{value}</div>
    </div>
  </div>
);
