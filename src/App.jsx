import React, { useState, useEffect } from 'react';
import { 
    LayoutDashboard, ShoppingCart, Package, History, Store, Wallet, 
    FileText, BookUser, Settings, QrCode, CreditCard, Banknote, 
    Users, LogOut, Lock, Bluetooth 
} from 'lucide-react';
import { db } from './db';
import { formatRupiah, printReceipt, printBluetooth } from './utils';

// Import Semua Halaman
import LoginView from './components/LoginView';
import PosView from './components/PosView';
import InventoryView from './components/InventoryView';
import SettingsView from './components/SettingsView';
import DashboardView from './components/DashboardView';
import TransactionsView from './components/TransactionsView';
import KasbonView from './components/KasbonView';
import ExpenseView from './components/ExpenseView';
import CustomersView from './components/CustomersView';

function App() {
    // STATE USER (KEAMANAN)
    const [currentUser, setCurrentUser] = useState(null); // null = Belum Login
    
    // State App Biasa
    const [view, setView] = useState('pos');
    const [cart, setCart] = useState([]);
    
    // State Pembayaran
    const [payModal, setPayModal] = useState(false);
    const [payAmount, setPayAmount] = useState('');
    const [discount, setDiscount] = useState('');
    const [subtotalForPay, setSubtotalForPay] = useState(0);
    const [successTx, setSuccessTx] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash', 'qris', 'transfer'
    const [paymentConfig, setPaymentConfig] = useState({ qris: '', bank: '' });
    
    // State System
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);

    // --- LOAD CONFIG SAAT LOGIN ---
    useEffect(() => {
        const loadConfig = async () => {
            const q = await db.settings.get('qrisImage');
            const b = await db.settings.get('bankAccount');
            setPaymentConfig({ qris: q?.value || '', bank: b?.value || '' });
        };
        if(currentUser) loadConfig();
    }, [payModal, currentUser]);

    // --- SHORTCUTS GLOBAL ---
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            if (!currentUser) return; // Kunci shortcut kalau belum login

            // F2: Bayar
            if (e.key === 'F2') {
                e.preventDefault();
                if (view === 'pos' && cart.length > 0 && !payModal && !successTx) {
                    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
                    setSubtotalForPay(total);
                    setPaymentMethod('cash');
                    setPayModal(true);
                }
            }
            // ESC: Tutup Modal
            if (e.key === 'Escape') {
                e.preventDefault();
                if (payModal) setPayModal(false);
                if (successTx) setSuccessTx(null);
            }
            // ENTER: Print (Saat Sukses)
            if (e.key === 'Enter' && successTx) {
                e.preventDefault();
                printReceipt(successTx); // Default Enter ke Print Browser
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [view, cart, payModal, successTx, currentUser]);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    // --- FUNGSI CHECKOUT UTAMA ---
    const handleCheckout = async () => {
        const discountVal = parseInt(discount) || 0;
        const paymentVal = parseInt(payAmount) || 0;
        const finalTotal = subtotalForPay - discountVal;

        // Validasi Pembayaran Tunai
        if (paymentVal < finalTotal && paymentMethod === 'cash') return showToast('Uang kurang!', 'error');
        
        const storeName = (await db.settings.get('storeName'))?.value || 'RUKO POS';

        // Hitung Modal (HPP) dengan Benar
        let totalCost = 0;
        const itemsWithCost = cart.map(item => {
            const baseCost = item.original_product?.cost_price || 0; 
            const conversion = item.conversion || 1; 
            // Modal = Harga Modal Satuan Dasar * Jumlah * Konversi Satuan
            const totalItemCost = baseCost * item.qty * conversion;
            totalCost += totalItemCost;
            
            return { ...item, cost_at_sale: baseCost };
        });

        const tx = {
            date: new Date().toISOString(),
            items: itemsWithCost,
            total: subtotalForPay,
            discount: discountVal,
            finalTotal: finalTotal,
            total_cost: totalCost,           // Modal Total
            profit: finalTotal - totalCost,  // Laba Bersih Transaksi
            payment: paymentVal,
            change: paymentVal - finalTotal,
            type: paymentMethod, 
            customerName: storeName, 
            synced: 0,
            cashier: currentUser.username // Catat siapa yang melayani
        };

        await db.transactions.add(tx);
        
        // Update Stok Fisik
        for (let item of cart) {
            const product = await db.products.get(item.id);
            if (product) {
                const qtyToDeduct = item.qty * (item.conversion || 1);
                await db.products.update(item.id, { stock: product.stock - qtyToDeduct });
            }
        }

        setCart([]);
        setPayModal(false);
        setPayAmount('');
        setDiscount('');
        setSuccessTx(tx);
        showToast('Transaksi Berhasil!');
    };

    const selectMethod = (method) => {
        setPaymentMethod(method);
        // Jika Non-Tunai, otomatis set Uang Pas
        if (method !== 'cash') {
            setPayAmount(subtotalForPay - (parseInt(discount) || 0));
        } else {
            setPayAmount('');
        }
    };

    const syncPushSmart = async () => {
        const urlItem = await db.settings.get('apiUrl');
        if (!urlItem || !urlItem.value) return showToast('URL App Script belum diatur!', 'error');
        
        if (!confirm('Sinkronisasi Data? Pastikan internet lancar.')) return;
        setLoading(true);
        try {
            const allProducts = await db.products.toArray();
            const unsyncedTx = await db.transactions.where('synced').equals(0).toArray();
            
            const productsPayload = allProducts.map(p => ({
                ...p,
                multi_units: p.multi_units || [] 
            }));

            const payload = JSON.stringify({ 
                action: 'overwrite_full', 
                products: productsPayload,
                transactions: unsyncedTx, 
                expenses: [] 
            });

            const response = await fetch(urlItem.value, { method: 'POST', body: payload });
            const result = await response.json();

            if (result.status === 'success') {
                if(unsyncedTx.length > 0) {
                    const ids = unsyncedTx.map(t => t.id);
                    await db.transactions.where('id').anyOf(ids).modify({ synced: 1 });
                }
                showToast('Sukses! Data tersinkronisasi.');
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            showToast('Gagal Sync: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        if(confirm('Yakin ingin keluar?')) {
            setCurrentUser(null);
            setView('pos');
        }
    };

    // --- LOGIKA MENU BERDASARKAN ROLE ---
    const getMenuItems = () => {
        const isAdmin = currentUser?.role === 'admin';
        
        // Menu Dasar (Semua Bisa)
        const items = [
            { id: 'pos', icon: <ShoppingCart />, label: 'Kasir' },
        ];

        // Menu Admin Only
        if (isAdmin) {
            items.push(
                { id: 'dashboard', icon: <LayoutDashboard />, label: 'Dashboard' },
                { id: 'inventory', icon: <Package />, label: 'Stok Barang' }
            );
        }

        // Menu Lanjutan (Semua Bisa)
        items.push(
            { id: 'transactions', icon: <FileText />, label: 'Riwayat' }
        );

        if (isAdmin) {
            items.push({ id: 'customers', icon: <Users />, label: 'Pelanggan' });
        }

        items.push({ id: 'kasbon', icon: <BookUser />, label: 'Kasbon' });

        if (isAdmin) {
            items.push(
                { id: 'expenses', icon: <Wallet />, label: 'Pengeluaran' },
                { id: 'settings', icon: <Settings />, label: 'Pengaturan' }
            );
        }

        return items;
    };


    // --- JIKA BELUM LOGIN, TAMPILKAN LAYAR LOGIN ---
    if (!currentUser) {
        return <LoginView onLogin={(user) => setCurrentUser(user)} />;
    }

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans text-slate-800">
            {/* SIDEBAR DINAMIS */}
            <div className="w-16 md:w-64 bg-slate-900 text-white flex flex-col justify-between shadow-xl z-20 h-screen shrink-0 transition-all duration-300">
                 <div>
                    <div className="h-16 flex items-center justify-center md:justify-start md:px-6 border-b border-slate-800 font-bold text-xl tracking-wider text-blue-400 overflow-hidden whitespace-nowrap">
                        <Store className="md:mr-3 shrink-0" />
                        <span className="hidden md:inline">RUKO POS v6</span>
                    </div>
                    
                    {/* User Info */}
                    <div className="hidden md:flex flex-col px-6 py-4 border-b border-slate-800 mb-2">
                        <span className="text-xs text-slate-400 uppercase font-bold">Halo,</span>
                        <span className="text-sm font-bold text-white truncate">{currentUser.username}</span>
                        <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded w-fit mt-1 text-blue-300 capitalize">{currentUser.role}</span>
                    </div>

                    <nav className="mt-2 flex flex-col gap-2 p-2">
                        {getMenuItems().map(menu => (
                            <button key={menu.id} onClick={() => setView(menu.id)} 
                                className={`flex items-center p-3 rounded-lg transition-all ${view === menu.id ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-400'}`}>
                                <div className="shrink-0">{menu.icon}</div>
                                <span className="hidden md:inline ml-3 font-medium whitespace-nowrap">{menu.label}</span>
                            </button>
                        ))}
                    </nav>
                </div>
                
                {/* Tombol Logout */}
                <div className="p-4 border-t border-slate-800">
                    <button onClick={handleLogout} className="w-full flex items-center justify-center md:justify-start p-3 rounded-lg text-red-400 hover:bg-red-900/20 transition-colors">
                        <LogOut className="shrink-0" />
                        <span className="hidden md:inline ml-3 font-bold">Keluar</span>
                    </button>
                </div>
            </div>

            <main className="flex-1 relative flex flex-col h-full overflow-hidden">
                {view === 'pos' && (
                    <PosView 
                        cart={cart} 
                        setCart={setCart} 
                        syncPushSmart={syncPushSmart}
                        loadingSync={loading}
                        onProcessPayment={(total) => { setSubtotalForPay(total); setPaymentMethod('cash'); setPayModal(true); }}
                        activeUser={currentUser} 
                    />
                )}
                
                {/* PROTEKSI VIEW: Hanya Admin yang bisa akses Dashboard, Inventory, dll */}
                {view === 'dashboard' && currentUser.role === 'admin' && <DashboardView />}
                {view === 'inventory' && currentUser.role === 'admin' && <InventoryView />}
                {view === 'transactions' && <TransactionsView />}
                {view === 'customers' && currentUser.role === 'admin' && <CustomersView />}
                {view === 'kasbon' && <KasbonView />}
                {view === 'expenses' && currentUser.role === 'admin' && <ExpenseView />}
                {view === 'settings' && currentUser.role === 'admin' && <SettingsView />}
                
                {/* Fallback jika akses ditolak (Misal Kasir mencoba akses URL dashboard) */}
                {(currentUser.role !== 'admin' && ['dashboard', 'inventory', 'expenses', 'settings', 'customers'].includes(view)) && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <Lock size={64} className="mb-4 text-slate-300"/>
                        <h2 className="text-xl font-bold">Akses Ditolak</h2>
                        <p>Menu ini khusus Admin.</p>
                    </div>
                )}
            </main>

            {/* MODAL BAYAR */}
            {payModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden anim-scale relative flex flex-col md:flex-row h-[500px] md:h-auto">
                        <button onClick={() => setPayModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-red-400 z-10"><X className="w-6 h-6"/></button>

                        <div className="w-full md:w-1/3 bg-slate-50 p-4 border-r border-slate-200">
                            <h3 className="font-bold text-slate-700 mb-4">Pilih Metode</h3>
                            <div className="space-y-2">
                                <button onClick={() => selectMethod('cash')} className={`w-full p-3 rounded-lg flex items-center gap-3 font-bold transition-all ${paymentMethod === 'cash' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-blue-50 border'}`}>
                                    <Banknote size={20}/> TUNAI (Cash)
                                </button>
                                <button onClick={() => selectMethod('qris')} className={`w-full p-3 rounded-lg flex items-center gap-3 font-bold transition-all ${paymentMethod === 'qris' ? 'bg-purple-600 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-purple-50 border'}`}>
                                    <QrCode size={20}/> QRIS Scan
                                </button>
                                <button onClick={() => selectMethod('transfer')} className={`w-full p-3 rounded-lg flex items-center gap-3 font-bold transition-all ${paymentMethod === 'transfer' ? 'bg-orange-600 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-orange-50 border'}`}>
                                    <CreditCard size={20}/> TRANSFER BANK
                                </button>
                            </div>
                            <div className="mt-8 p-4 bg-white rounded-lg border text-center">
                                <p className="text-xs text-slate-500 mb-1">Total Tagihan</p>
                                <h2 className="text-2xl font-black text-slate-800">{formatRupiah(subtotalForPay - (parseInt(discount)||0))}</h2>
                            </div>
                        </div>

                        <div className="flex-1 p-6 flex flex-col">
                            <div className="flex-1">
                                {paymentMethod === 'cash' && (
                                    <div className="space-y-4">
                                        <h3 className="font-bold text-lg text-slate-700">Pembayaran Tunai</h3>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase">Bayar (Rp)</label>
                                            <input autoFocus type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} 
                                                className="w-full p-3 border-2 border-blue-500 rounded-lg text-xl font-bold text-right focus:outline-none" placeholder="0" 
                                                onKeyDown={e => e.key === 'Enter' && handleCheckout()}
                                            />
                                        </div>
                                        <div className="grid grid-cols-4 gap-2">
                                            {[10000, 20000, 50000, 100000].map(m => (
                                                <button key={m} onClick={() => setPayAmount(m)} className="bg-slate-100 py-2 rounded font-bold text-slate-600 hover:bg-blue-100">{m/1000}k</button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {paymentMethod === 'qris' && (
                                    <div className="text-center h-full flex flex-col items-center justify-center">
                                        <h3 className="font-bold text-lg text-purple-700 mb-2">Scan QRIS</h3>
                                        {paymentConfig.qris ? (
                                            <img src={paymentConfig.qris} className="w-48 h-48 object-contain border rounded-lg shadow-sm mb-4" alt="QRIS"/>
                                        ) : (
                                            <div className="w-48 h-48 bg-slate-100 rounded flex items-center justify-center text-slate-400 text-xs mb-4">Belum ada QRIS di Setting</div>
                                        )}
                                        <p className="text-sm font-bold text-slate-600">Total: {formatRupiah(subtotalForPay - (parseInt(discount)||0))}</p>
                                        <p className="text-xs text-slate-400 mt-2">Pastikan pembayaran berhasil sebelum konfirmasi.</p>
                                    </div>
                                )}

                                {paymentMethod === 'transfer' && (
                                    <div className="text-center h-full flex flex-col items-center justify-center">
                                        <h3 className="font-bold text-lg text-orange-700 mb-4">Transfer Bank</h3>
                                        <div className="bg-orange-50 p-6 rounded-xl border border-orange-100 w-full mb-4">
                                            <pre className="text-slate-700 font-bold font-mono whitespace-pre-wrap">{paymentConfig.bank || "Belum ada Info Bank di Setting"}</pre>
                                        </div>
                                        <p className="text-sm font-bold text-slate-600">Total: {formatRupiah(subtotalForPay - (parseInt(discount)||0))}</p>
                                    </div>
                                )}
                            </div>

                            <button onClick={handleCheckout} className={`w-full text-white py-4 rounded-xl font-bold text-lg shadow-lg mt-4 ${paymentMethod==='cash'?'bg-blue-600 hover:bg-blue-700': paymentMethod==='qris'?'bg-purple-600 hover:bg-purple-700':'bg-orange-600 hover:bg-orange-700'}`}>
                                {paymentMethod === 'cash' ? 'BAYAR SEKARANG' : 'KONFIRMASI SUDAH DIBAYAR'} (Enter)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL SUKSES */}
            {successTx && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 text-center anim-scale">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Store size={32} />
                        </div>
                        <h3 className="text-xl font-bold mb-1">Transaksi Berhasil!</h3>
                        
                        <div className="mb-6">
                             <span className={`px-3 py-1 rounded-full text-xs font-bold ${successTx.type === 'cash' ? 'bg-blue-100 text-blue-700' : successTx.type === 'qris' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                                VIA {successTx.type.toUpperCase()}
                            </span>
                            {successTx.type === 'cash' && (
                                <p className="text-slate-500 mt-2">Kembali: <span className="font-bold text-slate-800">{formatRupiah(successTx.change)}</span></p>
                            )}
                        </div>

                        <div className="space-y-2">
                            {/* TOMBOL CETAK BROWSER */}
                            <button onClick={() => printReceipt(successTx)} className="w-full bg-slate-100 text-slate-700 py-3 rounded-lg font-bold border hover:bg-slate-200">
                                Cetak Browser (PC)
                            </button>

                            {/* TOMBOL CETAK BLUETOOTH (RawBT) */}
                            <button onClick={() => printBluetooth(successTx)} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold shadow-lg shadow-blue-200 flex items-center justify-center gap-2 hover:bg-blue-700">
                                <Bluetooth size={18} /> Cetak Bluetooth (HP)
                            </button>

                            <button onClick={() => setSuccessTx(null)} className="w-full bg-white text-red-500 py-2 rounded-lg font-bold text-sm hover:underline">
                                Tutup / Transaksi Baru (Esc)
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {toast && <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-lg shadow-xl text-white font-medium z-[100] ${toast.type === 'error' ? 'bg-red-600' : 'bg-slate-800'}`}>{toast.message}</div>}
        </div>
    );
}

const X = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>);

export default App;