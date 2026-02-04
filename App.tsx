
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Utensils, 
  Users, 
  LayoutDashboard, 
  Plus, 
  Trash2, 
  Download, 
  ChevronRight,
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Minus,
  ShoppingCart,
  Search,
  ClipboardList,
  Database,
  RefreshCw,
  Link as LinkIcon
} from 'lucide-react';
import { FoodItem, Order, OrderItem, ViewType } from './types';
import { exportToExcel, generateExcelBuffer, parseExcelData } from './services/excelService';

const LOCAL_STORAGE_KEY = 'food_order_app_data_v4';

export default function App() {
  const [view, setView] = useState<ViewType>('dashboard');
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // File System State - Fix: Use any for FileSystemFileHandle which may not be available in standard TypeScript types
  const [fileHandle, setFileHandle] = useState<any | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Form states
  const [foodForm, setFoodForm] = useState({ name: '', price: '' });
  const [orderCustomerName, setOrderCustomerName] = useState('');
  const [draftQuantities, setDraftQuantities] = useState<Record<string, number>>({});

  // 1. Load Initial Data from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        const { foods, orders } = JSON.parse(saved);
        setFoods(foods || []);
        setOrders(orders || []);
      } catch (e) {
        console.error("Lỗi khi tải dữ liệu LocalStorage", e);
      }
    }
  }, []);

  // 2. Persist to LocalStorage whenever state changes
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ foods, orders }));
  }, [foods, orders]);

  // 3. Auto-Save to connected File Handle
  const saveToFile = useCallback(async (currentFoods: FoodItem[], currentOrders: Order[]) => {
    if (!fileHandle) return;
    
    setIsSyncing(true);
    try {
      // Fix: Use 'any' cast as 'FileSystemPermissionMode' might not be defined in the current TypeScript environment
      const options = { mode: 'readwrite' as any };
      if ((await fileHandle.queryPermission(options)) !== 'granted') {
        if ((await fileHandle.requestPermission(options)) !== 'granted') {
          alert("Không có quyền ghi vào file. Vui lòng cấp quyền.");
          return;
        }
      }

      const buffer = generateExcelBuffer(currentFoods, currentOrders);
      const writable = await fileHandle.createWritable();
      await writable.write(buffer);
      await writable.close();
      console.log("Đã tự động lưu vào file Excel.");
    } catch (err) {
      console.error("Lỗi khi lưu vào file:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [fileHandle]);

  // Trigger file save on data change if connected
  useEffect(() => {
    const timer = setTimeout(() => {
      if (fileHandle) saveToFile(foods, orders);
    }, 1000); // Debounce save
    return () => clearTimeout(timer);
  }, [foods, orders, fileHandle, saveToFile]);

  // Connect to a file
  const connectFile = async () => {
    try {
      // Fix: Cast 'window' to 'any' to access the experimental 'showOpenFilePicker' API
      const [handle] = await (window as any).showOpenFilePicker({
        types: [{
          description: 'Excel Files',
          accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
        }],
        multiple: false
      });

      const file = await handle.getFile();
      const buffer = await file.arrayBuffer();
      const { foods: newFoods, orders: newOrders } = await parseExcelData(buffer);
      
      setFileHandle(handle);
      setFoods(newFoods);
      setOrders(newOrders);
      alert(`Đã kết nối và đồng bộ với file: ${file.name}`);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        alert("Trình duyệt của bạn có thể không hỗ trợ tính năng kết nối file trực tiếp hoặc đã xảy ra lỗi.");
      }
    }
  };

  // Actions
  const addFood = (e: React.FormEvent) => {
    e.preventDefault();
    if (!foodForm.name || !foodForm.price) return;
    const newFood: FoodItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: foodForm.name,
      price: parseFloat(foodForm.price)
    };
    setFoods([...foods, newFood]);
    setFoodForm({ name: '', price: '' });
  };

  const removeFood = (id: string) => {
    if (confirm("Xóa món ăn này khỏi thực đơn?")) {
      setFoods(foods.filter(f => f.id !== id));
      const newDraft = { ...draftQuantities };
      delete newDraft[id];
      setDraftQuantities(newDraft);
    }
  };

  const updateDraftQuantity = (foodId: string, delta: number) => {
    setDraftQuantities(prev => {
      const current = prev[foodId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [foodId]: next };
    });
  };

  const setManualQuantity = (foodId: string, value: string) => {
    const qty = parseInt(value) || 0;
    setDraftQuantities(prev => ({ ...prev, [foodId]: Math.max(0, qty) }));
  };

  const addOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const items: OrderItem[] = (Object.entries(draftQuantities) as [string, number][])
      .filter(([_, qty]) => qty > 0)
      .map(([foodId, quantity]) => ({ foodId, quantity }));

    if (!orderCustomerName) {
      alert("Vui lòng nhập tên khách hàng.");
      return;
    }
    if (items.length === 0) {
      alert("Vui lòng chọn ít nhất một món ăn.");
      return;
    }
    
    const newOrder: Order = {
      id: Math.random().toString(36).substr(2, 9),
      customerName: orderCustomerName,
      items,
      orderDate: new Date().toLocaleString('vi-VN')
    };
    
    setOrders([...orders, newOrder]);
    setOrderCustomerName('');
    setDraftQuantities({});
    alert("Đơn hàng đã được lưu!");
  };

  const removeOrder = (id: string) => {
    if (confirm("Xác nhận xóa đơn hàng này?")) {
      setOrders(orders.filter(o => o.id !== id));
    }
  };

  // Calculations
  const getOrderTotal = (order: Order) => {
    return order.items.reduce((sum, item) => {
      const food = foods.find(f => f.id === item.foodId);
      return sum + (food ? food.price * item.quantity : 0);
    }, 0);
  };

  const draftTotal = useMemo(() => {
    return (Object.entries(draftQuantities) as [string, number][]).reduce((sum, [foodId, qty]) => {
      const food = foods.find(f => f.id === foodId);
      return sum + (food ? food.price * qty : 0);
    }, 0);
  }, [draftQuantities, foods]);

  const totalRevenue = orders.reduce((sum, order) => sum + getOrderTotal(order), 0);
  const totalItemsCount = orders.reduce((sum, order) => 
    sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);

  const filteredFoods = foods.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));

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

        <div className="flex flex-col gap-2">
          <SidebarLink active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<LayoutDashboard size={20}/>} label="Tổng quan" />
          <SidebarLink active={view === 'food-management'} onClick={() => setView('food-management')} icon={<Utensils size={20}/>} label="Thực đơn" />
          <SidebarLink active={view === 'order-management'} onClick={() => setView('order-management')} icon={<Users size={20}/>} label="Đặt món" />
        </div>

        {/* Database Sync Section */}
        <div className="mt-auto p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Database size={12} /> Database Sync
            </h4>
            {isSyncing && <RefreshCw size={12} className="text-emerald-500 animate-spin" />}
          </div>
          
          {fileHandle ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-emerald-600 font-bold bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                <LinkIcon size={14} /> Tự động đồng bộ
              </div>
              <p className="text-[10px] text-slate-500 truncate italic px-1">File: {fileHandle.name}</p>
              <button onClick={() => setFileHandle(null)} className="w-full py-1.5 text-[10px] text-rose-500 font-bold hover:bg-rose-50 rounded-lg transition-colors border border-rose-100">Ngắt kết nối file</button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[10px] text-slate-500 leading-relaxed px-1 italic">Dữ liệu hiện tại chỉ lưu trên trình duyệt.</p>
              <button onClick={connectFile} className="w-full py-2.5 bg-emerald-500 text-white text-xs font-bold rounded-xl hover:bg-emerald-600 shadow-md transition-all flex items-center justify-center gap-2">
                <LinkIcon size={14} /> Kết nối File Excel
              </button>
            </div>
          )}

          <div className="pt-2 border-t border-slate-200">
             <button onClick={() => exportToExcel(foods, orders)} className="w-full flex items-center justify-center gap-2 py-2 text-xs text-slate-600 hover:bg-white rounded-lg transition-all font-medium border border-transparent hover:border-slate-200">
              <Download size={14} /> Tải bản sao Excel
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto max-h-screen">
        {view === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <header>
              <h2 className="text-3xl font-bold text-slate-800">Báo cáo hôm nay</h2>
              <p className="text-slate-500">Tình hình doanh thu và số lượng đơn hàng hiện tại.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard title="Doanh thu" value={`${totalRevenue.toLocaleString()}đ`} icon={<DollarSign className="text-emerald-500" />} color="bg-emerald-50" />
              <StatCard title="Đơn hàng" value={orders.length.toString()} icon={<ShoppingBag className="text-blue-500" />} color="bg-blue-50" />
              <StatCard title="Tổng phần ăn" value={totalItemsCount.toString()} icon={<TrendingUp className="text-orange-500" />} color="bg-orange-50" />
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-lg">Giao dịch gần đây</h3>
                <button onClick={() => setView('order-management')} className="text-emerald-600 text-sm font-semibold flex items-center hover:underline">
                  Xem tất cả <ChevronRight size={16} />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                    <tr>
                      <th className="px-6 py-4">Khách hàng</th>
                      <th className="px-6 py-4">Chi tiết món</th>
                      <th className="px-6 py-4 text-right">Tổng thanh toán</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.slice(-5).reverse().map(order => (
                      <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                           <div className="font-semibold text-slate-800">{order.customerName}</div>
                           <div className="text-[10px] text-slate-400">{order.orderDate}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {order.items.map((item, idx) => {
                              const food = foods.find(f => f.id === item.foodId);
                              return (
                                <span key={idx} className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-md border border-slate-200">
                                  {food?.name} x{item.quantity}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-emerald-600">
                          {getOrderTotal(order).toLocaleString()}đ
                        </td>
                      </tr>
                    ))}
                    {orders.length === 0 && (
                      <tr><td colSpan={3} className="px-6 py-12 text-center text-slate-400 italic">Chưa có đơn hàng nào.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {view === 'food-management' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            <header>
              <h2 className="text-3xl font-bold text-slate-800">Quản lý thực đơn</h2>
              <p className="text-slate-500">Thiết lập danh sách món ăn và giá bán.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                  <Plus size={20} className="text-emerald-500" /> Thêm món mới
                </h3>
                <form onSubmit={addFood} className="space-y-5">
                  <FormField label="Tên món ăn" value={foodForm.name} onChange={v => setFoodForm({...foodForm, name: v})} placeholder="Ví dụ: Phở bò" />
                  <FormField label="Giá bán (VNĐ)" type="number" value={foodForm.price} onChange={v => setFoodForm({...foodForm, price: v})} placeholder="Ví dụ: 45000" />
                  <button type="submit" className="w-full py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 shadow-lg shadow-emerald-100 transition-all active:scale-95">Lưu món ăn</button>
                </form>
              </div>

              <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                    <tr>
                      <th className="px-6 py-4">Tên món</th>
                      <th className="px-6 py-4 text-right">Đơn giá</th>
                      <th className="px-6 py-4 text-center">Xóa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {foods.map(food => (
                      <tr key={food.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-800">{food.name}</td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-slate-600">{food.price.toLocaleString()}đ</td>
                        <td className="px-6 py-4 text-center">
                          <button onClick={() => removeFood(food.id)} className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
                        </td>
                      </tr>
                    ))}
                    {foods.length === 0 && (
                      <tr><td colSpan={3} className="px-6 py-12 text-center text-slate-400">Chưa có món nào.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {view === 'order-management' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            <header>
              <h2 className="text-3xl font-bold text-slate-800">Đặt món ngay</h2>
              <p className="text-slate-500">Chọn tên khách hàng và tùy chỉnh số lượng món ăn.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              <div className="lg:col-span-3 space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="flex-1">
                      <FormField label="Tên khách hàng" value={orderCustomerName} onChange={setOrderCustomerName} placeholder="Nhập tên người đặt..." />
                    </div>
                    <div className="md:w-64">
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Tìm món ăn</label>
                      <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" placeholder="Tìm nhanh..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm transition-all" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Danh sách món ăn</h3>
                    <div className="grid grid-cols-1 gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                      {filteredFoods.map(food => {
                        const qty = draftQuantities[food.id] || 0;
                        return (
                          <div key={food.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${qty > 0 ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'bg-white border-slate-100'}`}>
                            <div className="flex-1">
                              <div className="font-bold text-slate-800">{food.name}</div>
                              <div className="text-sm text-emerald-600 font-semibold">{food.price.toLocaleString()}đ</div>
                            </div>
                            <div className="flex items-center gap-3">
                              <button type="button" onClick={() => updateDraftQuantity(food.id, -1)} className={`p-1.5 rounded-lg border transition-all ${qty > 0 ? 'bg-white border-emerald-200 text-emerald-600 hover:bg-emerald-100' : 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed'}`}><Minus size={18} /></button>
                              <input type="number" min="0" value={qty === 0 ? '' : qty} onChange={e => setManualQuantity(food.id, e.target.value)} placeholder="0" className="w-12 text-center font-bold bg-transparent outline-none text-lg text-slate-800" />
                              <button type="button" onClick={() => updateDraftQuantity(food.id, 1)} className="p-1.5 rounded-lg border bg-white border-emerald-200 text-emerald-600 hover:bg-emerald-100 transition-all"><Plus size={18} /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 space-y-6">
                <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl shadow-slate-200">
                  <div className="flex items-center gap-2 mb-6">
                    <ShoppingCart size={20} className="text-emerald-400" />
                    <h3 className="font-bold text-lg">Xác nhận đơn hàng</h3>
                  </div>

                  <div className="space-y-4 mb-6 min-h-[100px] max-h-[300px] overflow-y-auto pr-2 custom-scrollbar-dark">
                    {(Object.entries(draftQuantities) as [string, number][]).some(([_, qty]) => qty > 0) ? (
                      (Object.entries(draftQuantities) as [string, number][]).map(([foodId, qty]) => {
                        if (qty === 0) return null;
                        const food = foods.find(f => f.id === foodId);
                        return (
                          <div key={foodId} className="flex justify-between items-center text-sm border-b border-slate-800 pb-3">
                            <div>
                              <div className="font-semibold">{food?.name}</div>
                              <div className="text-slate-400 text-xs">{food?.price.toLocaleString()}đ x {qty}</div>
                            </div>
                            <div className="font-bold text-emerald-400">{((food?.price || 0) * qty).toLocaleString()}đ</div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-6 text-slate-500 italic text-sm">Chưa chọn món nào...</div>
                    )}
                  </div>

                  <div className="flex justify-between items-center mb-6 pt-2">
                    <span className="text-slate-400 font-medium">Tổng thanh toán:</span>
                    <span className="text-2xl font-black text-emerald-400">{draftTotal.toLocaleString()}đ</span>
                  </div>

                  <button onClick={addOrder} disabled={!orderCustomerName || draftTotal === 0} className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98]">HOÀN TẤT ĐẶT MÓN</button>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col max-h-[500px]">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2"><ClipboardList size={16} className="text-emerald-600" /> Các đơn gần đây</h4>
                  </div>
                  <div className="divide-y divide-slate-100 overflow-y-auto custom-scrollbar">
                    {orders.slice().reverse().map(order => (
                      <div key={order.id} className="p-5 hover:bg-slate-50 transition-colors relative group border-l-4 border-l-transparent hover:border-l-emerald-500">
                        <button onClick={() => removeOrder(order.id)} className="absolute right-4 top-4 p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16} /></button>
                        <div className="flex justify-between items-start mb-3 pr-8">
                          <div>
                            <div className="font-bold text-slate-900 leading-tight">{order.customerName}</div>
                            <div className="text-[10px] text-slate-400 mt-1">{order.orderDate}</div>
                          </div>
                          <div className="text-sm font-black text-emerald-600 whitespace-nowrap">{getOrderTotal(order).toLocaleString()}đ</div>
                        </div>
                        <div className="space-y-1.5">
                          {order.items.map((item, idx) => {
                            const food = foods.find(f => f.id === item.foodId);
                            return (
                              <div key={idx} className="flex justify-between items-center text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                <span className="font-semibold text-slate-800">{food?.name || 'Món đã xóa'} x{item.quantity}</span>
                                <span className="text-[10px] text-emerald-600 font-medium">{((food?.price || 0) * item.quantity).toLocaleString()}đ</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {orders.length === 0 && <div className="p-12 text-center text-slate-300 text-sm italic">Chưa có dữ liệu.</div>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Sub-components
const SidebarLink = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button onClick={onClick} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-emerald-50 text-emerald-600 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>{icon} {label}</button>
);

const FormField = ({ label, value, onChange, placeholder, type = "text" }: { label: string, value: any, onChange: (v: any) => void, placeholder: string, type?: string }) => (
  <div>
    <label className="block text-sm font-bold text-slate-700 mb-1.5">{label}</label>
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
