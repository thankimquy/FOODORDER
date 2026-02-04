
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
  AlertCircle,
  Globe,
  Copy,
  CheckCircle2,
  Info
} from 'lucide-react';
import { FoodItem, Order, OrderItem, ViewType } from './types';
import { exportToExcel, parseExcelData } from './services/excelService';
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
  const [showSyncInfo, setShowSyncInfo] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

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

  // Quick Sync via JSON (Copy/Paste)
  const handleExportJSON = async () => {
    const data = { foods, orders };
    const jsonStr = JSON.stringify(data);
    await navigator.clipboard.writeText(jsonStr);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleImportJSON = async () => {
    const jsonStr = prompt("Dán mã đồng bộ vào đây:");
    if (!jsonStr) return;
    try {
      const { foods: newFoods, orders: newOrders } = JSON.parse(jsonStr);
      if (confirm("Ghi đè dữ liệu từ mã đồng bộ này?")) {
        await db.transaction('rw', db.foods, db.orders, async () => {
          await db.foods.clear();
          await db.orders.clear();
          await db.foods.bulkAdd(newFoods);
          await db.orders.bulkAdd(newOrders);
        });
        alert("Đồng bộ thành công!");
      }
    } catch (e) {
      alert("Mã đồng bộ không hợp lệ.");
    }
  };

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
    if (confirm("Xóa món ăn này?")) await db.foods.delete(id);
  };

  const updateDraftQuantity = (foodId: string, delta: number) => {
    setDraftQuantities(prev => ({
      ...prev,
      [foodId]: Math.max(0, (prev[foodId] || 0) + delta)
    }));
  };

  // Fix: Added cancelEdit function to reset editing states
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
          <div className="bg-emerald-500 p-2.5 rounded-xl text-white shadow-lg shadow-emerald-100">
            <Utensils size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent leading-none">
              FoodOrder
            </h1>
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-tighter">Pro Management</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <SidebarLink active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<LayoutDashboard size={18}/>} label="Bảng điều khiển" />
          <SidebarLink active={view === 'food-management'} onClick={() => setView('food-management')} icon={<Utensils size={18}/>} label="Quản lý món ăn" />
          <SidebarLink active={view === 'order-management'} onClick={() => setView('order-management')} icon={<Users size={18}/>} label="Đơn hàng" />
        </div>

        {/* Local DB Status */}
        <div className="mt-auto space-y-4">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Database size={12} /> Local SQL Active
              </h4>
              <button onClick={() => setShowSyncInfo(!showSyncInfo)} className="text-slate-400 hover:text-emerald-500 transition-colors">
                <Info size={14} />
              </button>
            </div>
            
            {showSyncInfo && (
              <div className="mb-4 text-[10px] text-slate-500 leading-relaxed bg-amber-50 p-2 rounded-lg border border-amber-100 animate-in fade-in zoom-in duration-200">
                <AlertCircle size={10} className="inline mr-1 text-amber-500" /> 
                Dữ liệu hiện chỉ nằm trên trình duyệt này. Để dùng ở máy khác, hãy dùng tính năng Xuất/Nhập bên dưới.
              </div>
            )}

            <div className="grid grid-cols-1 gap-2">
              <button 
                onClick={() => exportToExcel(foods, orders)}
                className="flex items-center justify-center gap-2 py-2 bg-white border border-slate-200 text-[11px] font-bold text-slate-700 rounded-xl hover:bg-slate-100 transition-all shadow-sm"
              >
                <Download size={12} className="text-emerald-500" /> Xuất Excel
              </button>
              
              <label className="flex items-center justify-center gap-2 py-2 bg-white border border-slate-200 text-[11px] font-bold text-slate-700 rounded-xl hover:bg-slate-100 transition-all shadow-sm cursor-pointer">
                <Upload size={12} className="text-blue-500" /> Nhập Excel
                <input type="file" accept=".xlsx" className="hidden" onChange={handleImportExcel} />
              </label>

              <div className="pt-2 border-t border-slate-200 mt-2 flex gap-2">
                <button onClick={handleExportJSON} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-900 text-white text-[10px] font-bold rounded-xl hover:bg-slate-800 transition-all">
                  {copySuccess ? <CheckCircle2 size={12} /> : <Copy size={12} />} 
                  {copySuccess ? "Đã chép mã" : "Chép mã đồng bộ"}
                </button>
                <button onClick={handleImportJSON} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-xl hover:bg-slate-200 transition-all">
                  <Globe size={12} /> Dán mã
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-12 overflow-y-auto max-h-screen">
        {view === 'dashboard' && (
          <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in slide-in-from-top-4 duration-700">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight">Tổng quan hệ thống</h2>
                <p className="text-slate-500 font-medium">Báo cáo hiệu suất kinh doanh từ Database nội bộ.</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                Dữ liệu thời gian thực
              </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <StatCard title="Doanh thu" value={`${totalRevenue.toLocaleString()}đ`} icon={<DollarSign className="text-emerald-600" />} color="bg-emerald-100" />
              <StatCard title="Đơn hàng" value={orders.length.toString()} icon={<ShoppingBag className="text-blue-600" />} color="bg-blue-100" />
              <StatCard title="Thực đơn" value={foods.length.toString()} icon={<Utensils className="text-orange-600" />} color="bg-orange-100" />
            </div>

            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-black text-xl text-slate-800">Giao dịch gần nhất</h3>
                <TrendingUp size={20} className="text-slate-300" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                    <tr>
                      <th className="px-8 py-5">Khách hàng</th>
                      <th className="px-8 py-5">Chi tiết món</th>
                      <th className="px-8 py-5 text-right">Tổng tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.slice(0, 5).map(order => (
                      <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-6">
                          <div className="font-bold text-slate-800">{order.customerName}</div>
                          <div className="text-[11px] text-slate-400 font-medium">{order.orderDate}</div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex flex-wrap gap-1.5">
                            {order.items.map((it, idx) => (
                              <span key={idx} className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded-lg text-slate-600 font-bold shadow-sm">
                                {foods.find(f => f.id === it.foodId)?.name} <span className="text-emerald-500">x{it.quantity}</span>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right font-black text-slate-900 text-lg">
                          {getOrderTotal(order).toLocaleString()}<span className="text-[12px] ml-0.5">đ</span>
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
          <div className="max-w-6xl mx-auto space-y-10 animate-in slide-in-from-bottom-6 duration-500">
            <header>
              <h2 className="text-4xl font-black text-slate-900 tracking-tight">Thực đơn</h2>
              <p className="text-slate-500 font-medium">Xây dựng danh sách món ăn cho quán của bạn.</p>
            </header>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 h-fit sticky top-10">
                <h3 className="font-black text-xl mb-8 flex items-center gap-3 text-slate-800">
                  <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600"><Plus size={20} /></div> 
                  Tạo món mới
                </h3>
                <form onSubmit={addFood} className="space-y-6">
                  <FormField label="Tên món ăn" value={foodForm.name} onChange={v => setFoodForm({...foodForm, name: v})} placeholder="VD: Phở Bò Tái Lăn..." />
                  <FormField label="Giá niêm yết (VNĐ)" type="number" value={foodForm.price} onChange={v => setFoodForm({...foodForm, price: v})} placeholder="45000" />
                  <button className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95">Lưu vào thực đơn</button>
                </form>
              </div>
              <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type="text" placeholder="Tìm kiếm món ăn trong kho..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-6 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all" />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto max-h-[600px]">
                  <table className="w-full">
                    <thead className="bg-slate-50 text-[11px] uppercase font-black text-slate-400 sticky top-0 z-10 border-b border-slate-100">
                      <tr>
                        <th className="px-8 py-4 text-left">Món ăn</th>
                        <th className="px-8 py-4 text-right">Giá</th>
                        <th className="px-8 py-4 text-center w-24">Xử lý</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredFoods.map(f => (
                        <tr key={f.id} className="hover:bg-slate-50/50 group">
                          <td className="px-8 py-5 font-bold text-slate-800">{f.name}</td>
                          <td className="px-8 py-5 text-right font-black text-emerald-600">{f.price.toLocaleString()}đ</td>
                          <td className="px-8 py-5 text-center">
                            <button onClick={() => removeFood(f.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"><Trash2 size={18}/></button>
                          </td>
                        </tr>
                      ))}
                      {filteredFoods.length === 0 && <tr><td colSpan={3} className="py-20 text-center text-slate-300 font-medium italic">Chưa có món ăn nào.</td></tr>}
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
              <p className="text-slate-500 font-medium">Ghi nhận đơn hàng và quản lý danh sách chờ.</p>
            </header>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
              {/* Menu Selection */}
              <div className="lg:col-span-3 space-y-6">
                <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <FormField label="Khách hàng" value={orderCustomerName} onChange={setOrderCustomerName} placeholder="Nhập tên khách..." />
                    <div className="relative pt-7">
                      <Search className="absolute left-4 top-[72%] -translate-y-1/2 text-slate-400" size={18} />
                      <input type="text" placeholder="Tìm món..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-6 py-3.5 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-emerald-500/10 text-sm font-medium transition-all" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-2 custom-scrollbar">
                    {filteredFoods.map(f => {
                      const qty = draftQuantities[f.id] || 0;
                      return (
                        <div key={f.id} className={`group flex flex-col p-4 rounded-2xl border transition-all cursor-pointer select-none active:scale-[0.98] ${qty > 0 ? 'bg-emerald-50 border-emerald-500 shadow-md shadow-emerald-100' : 'bg-white border-slate-100 hover:border-emerald-200 hover:bg-slate-50'}`}>
                          <div className="flex justify-between items-start mb-4">
                            <div className="font-black text-slate-800 leading-tight pr-2">{f.name}</div>
                            <div className="text-emerald-600 font-black text-sm">{f.price.toLocaleString()}đ</div>
                          </div>
                          <div className="flex items-center justify-between mt-auto">
                            <div className="flex items-center gap-1">
                                <button onClick={(e) => { e.stopPropagation(); updateDraftQuantity(f.id, -1); }} className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg hover:bg-slate-100 shadow-sm"><Minus size={14}/></button>
                                <span className={`w-8 text-center font-black text-sm ${qty > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>{qty}</span>
                                <button onClick={(e) => { e.stopPropagation(); updateDraftQuantity(f.id, 1); }} className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg hover:bg-slate-100 shadow-sm"><Plus size={14}/></button>
                            </div>
                            {qty > 0 && <CheckCircle2 size={16} className="text-emerald-500" />}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Order Summary Checkout */}
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-2xl relative overflow-hidden ring-8 ring-slate-100">
                  {editingOrderId && <div className="absolute top-0 right-0 bg-amber-500 text-slate-900 text-[10px] font-black px-4 py-1.5 rounded-bl-xl shadow-lg">CHẾ ĐỘ CHỈNH SỬA</div>}
                  <h3 className="font-black text-xl mb-6 flex items-center gap-3"><ShoppingCart size={22} className="text-emerald-400" /> Giỏ hàng</h3>
                  
                  <div className="space-y-3 mb-8 min-h-[120px] max-h-[240px] overflow-y-auto custom-scrollbar-dark pr-3">
                    {(Object.entries(draftQuantities) as [string, number][]).map(([id, qty]) => qty > 0 && (
                      <div key={id} className="flex justify-between items-center text-sm bg-slate-800/50 p-3 rounded-xl border border-slate-800">
                        <div className="flex flex-col">
                          <span className="font-bold">{foods.find(f => f.id === id)?.name}</span>
                          <span className="text-[10px] text-slate-500">x{qty} cái</span>
                        </div>
                        <span className="font-black text-emerald-400">{( (foods.find(f => f.id === id)?.price || 0) * qty).toLocaleString()}đ</span>
                      </div>
                    ))}
                    {Object.values(draftQuantities).every(q => q === 0) && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600 italic py-10 opacity-50">
                            <ShoppingCart size={32} className="mb-2" />
                            <p className="text-xs">Chưa chọn món nào</p>
                        </div>
                    )}
                  </div>

                  <div className="flex justify-between items-end mb-8 border-t border-slate-800 pt-6">
                    <div className="text-slate-500 text-xs font-bold uppercase tracking-widest">Tổng cộng:</div>
                    <div className="text-4xl font-black text-emerald-400 tracking-tighter">{draftTotal(draftQuantities, foods).toLocaleString()}<span className="text-lg ml-1">đ</span></div>
                  </div>

                  <div className="flex gap-3">
                    {editingOrderId && <button onClick={cancelEdit} className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 font-black rounded-2xl text-xs uppercase tracking-widest transition-all">Hủy</button>}
                    <button onClick={saveOrder} className={`flex-[2] py-4 font-black rounded-2xl text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 ${editingOrderId ? 'bg-amber-500 text-slate-900 shadow-amber-900/20' : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-900/20'}`}>
                      {editingOrderId ? 'Cập nhật đơn' : 'Gửi đơn hàng'}
                    </button>
                  </div>
                </div>

                {/* Local Order History List */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-[520px]">
                  <div className="p-6 bg-slate-50 border-b border-slate-100 space-y-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ClipboardList size={16} className="text-slate-300" /> Danh sách chờ</h4>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input type="text" placeholder="Tìm khách..." value={orderSearchTerm} onChange={e => setOrderSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all" />
                    </div>
                  </div>
                  <div className="overflow-y-auto flex-1 divide-y divide-slate-100 custom-scrollbar">
                    {paginatedOrders.map(o => (
                      <div key={o.id} className={`p-5 hover:bg-slate-50/80 group relative transition-all border-l-4 ${editingOrderId === o.id ? 'border-amber-500 bg-amber-50/30' : 'border-transparent hover:border-emerald-500'}`}>
                        <div className="absolute right-3 top-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
                          <button onClick={() => { setEditingOrderId(o.id); setOrderCustomerName(o.customerName); const nd: Record<string, number> = {}; o.items.forEach(i => nd[i.foodId] = i.quantity); setDraftQuantities(nd); }} className="p-2 text-amber-600 hover:bg-white rounded-lg shadow-sm border border-slate-100"><Edit2 size={12}/></button>
                          <button onClick={() => removeOrder(o.id)} className="p-2 text-rose-600 hover:bg-white rounded-lg shadow-sm border border-slate-100"><Trash2 size={12}/></button>
                        </div>
                        <div className="flex justify-between mb-3 pr-16">
                          <div>
                            <div className="font-black text-slate-800 text-sm">{o.customerName}</div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase">{o.orderDate}</div>
                          </div>
                          <div className="text-xs font-black text-emerald-600">{getOrderTotal(o).toLocaleString()}đ</div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {o.items.map((it, idx) => (
                             <span key={idx} className="text-[9px] bg-slate-100/50 border border-slate-200 px-2 py-0.5 rounded-lg text-slate-500 font-bold">
                               {foods.find(f => f.id === it.foodId)?.name} x{it.quantity}
                             </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {filteredOrdersList.length === 0 && <div className="p-12 text-center text-slate-300 text-xs italic font-medium">Lịch sử đơn hàng trống.</div>}
                  </div>
                  {/* Footer Pagination */}
                  {totalOrderPages > 1 && (
                    <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <button disabled={orderCurrentPage === 1} onClick={() => setOrderCurrentPage(p => p - 1)} className="p-2 bg-white border border-slate-200 rounded-lg shadow-sm disabled:opacity-30 hover:bg-slate-50 transition-colors"><ChevronLeft size={16}/></button>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trang {orderCurrentPage} / {totalOrderPages}</span>
                      <button disabled={orderCurrentPage === totalOrderPages} onClick={() => setOrderCurrentPage(p => p + 1)} className="p-2 bg-white border border-slate-200 rounded-lg shadow-sm disabled:opacity-30 hover:bg-slate-50 transition-colors"><ChevronRight size={16}/></button>
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
  <button onClick={onClick} className={`flex items-center gap-4 px-5 py-4 rounded-2xl transition-all ${active ? 'bg-slate-900 text-white font-black shadow-xl shadow-slate-200' : 'text-slate-500 hover:bg-slate-50 font-bold'}`}>
    {icon} 
    <span className="text-sm tracking-tight">{label}</span>
  </button>
);

const FormField = ({ label, value, onChange, placeholder, type = "text" }: { label: string, value: any, onChange: (v: any) => void, placeholder: string, type?: string }) => (
  <div className="w-full">
    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2.5">{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-sm font-medium bg-slate-50/30 focus:bg-white" />
  </div>
);

const StatCard = ({ title, value, icon, color }: { title: string, value: string, icon: React.ReactNode, color: string }) => (
  <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 flex items-center gap-8 group hover:-translate-y-1 transition-all duration-300">
    <div className={`p-5 rounded-2xl ${color} shadow-inner transition-transform group-hover:scale-110 duration-500`}>{icon}</div>
    <div>
      <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{title}</div>
      <div className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{value}</div>
    </div>
  </div>
);
