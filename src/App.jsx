import React, { useState, useEffect } from 'react';
import { 
    LayoutDashboard, ShoppingCart, Package, History, Store, Wallet, 
    FileText, BookUser, Settings, QrCode, CreditCard, Banknote, 
    Users, LogOut, Lock, Bluetooth, FileBarChart, AlertCircle, Percent, BadgePercent,
    Wifi, WifiOff
} from 'lucide-react';
// IMPORT FIREBASE
import { db, collection, addDoc, updateDoc, doc, getDocs, increment } from './firebase';
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
import ReportsView from './components/ReportsView';

function App() {
    const [currentUser, setCurrentUser] = useState(null); 
    const [view, setView] = useState('pos'); 
    const [cart, setCart] = useState([]); 
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    // --- STATE UPDATE STOK REALTIME ---
    const [lastSuccessItems, setLastSuccessItems] = useState([]); // <--- INI OBATNYA

    // --- STATE PEMBAYARAN ---
    const [payModal, setPayModal] = useState(false);
    const [payAmount, setPayAmount] = useState('');
    const [isProcessing, setIsProcessing] = useState(false); 
    
    // --- STATE DISKON ---
    const [discountMode, setDiscountMode] = useState('rp'); 
    const [discountInput, setDiscountInput] = useState(''); 
    
    const [subtotalForPay, setSubtotalForPay] = useState(0);
    const [successTx, setSuccessTx] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState('cash'); 
    const [paymentConfig, setPaymentConfig] = useState({ qris: '', bank: '' });
    
    // --- STATE SYSTEM ---
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine); 

    useEffect(() => {
        const handleOnline = () => { setIsOnline(true); showToast('Internet Terhubung (Online Mode)', 'success'); };
        const handleOffline = () => { setIsOnline(false); showToast('Internet Putus (Offline Mode)', 'error'); };
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        const loadConfig = async () => {
            if (currentUser) {
                try {
                    const settingsRef = collection(db, 'settings');
                    const snapshot = await getDocs(settingsRef);
                    const settingsMap = {};
                    snapshot.forEach(doc => {
                        settingsMap[doc.id] = doc.data().value;
                    });
                    setPaymentConfig({ qris: settingsMap['qrisImage'] || '', bank: settingsMap['bankAccount'] || '' });
                } catch (e) {}
            }
        };
        loadConfig();
    }, [currentUser]);

    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            if (!currentUser) return; 
            if (e.key === 'F2') {
                e.preventDefault();
                if (view === 'pos' && cart.length > 0 && !payModal && !successTx) {
                    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
                    setSubtotalForPay(total);
                    setPaymentMethod('cash');
                    setDiscountMode('rp');
                    setDiscountInput('');
                    setPayModal(true);
                }
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                if (payModal && !isProcessing) setPayModal(false); 
                if (successTx) setSuccessTx(null);
            }
            if (e.key === 'Enter' && successTx) {
                e.preventDefault();
                printReceipt(successTx); 
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [view, cart, payModal, successTx, currentUser, isProcessing]);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const calculateDiscountValue = () => {
        const val = parseInt(discountInput) || 0;
        if (discountMode === 'percent') {
            const percent = val > 100 ? 100 : val;
            return Math.round((percent / 100) * subtotalForPay);
        }
        return val;
    };

    const handleCheckout = async () => {
        if (isProcessing) return; 
        
        const discountVal = calculateDiscountValue(); 
        const paymentVal = parseInt(payAmount) || 0; 
        const finalTotal = subtotalForPay - discountVal;

        if (paymentMethod === 'cash' && paymentVal < finalTotal) return showToast('Uang kurang!', 'error');
        if (paymentMethod === 'debt' && !selectedCustomer) return showToast('Pilih Pelanggan dulu untuk Hutang!', 'error');
        
        setIsProcessing(true);

        const storeName = 'RUKO POS'; 
        const customerName = selectedCustomer ? selectedCustomer.name : 'Umum';

        let totalCost = 0;
        const itemsWithCost = cart.map(item => {
            const baseCost = parseInt(item.original_product?.cost_price) || 0;
            const conversion = parseInt(item.conversion) || 1; 
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
            total_cost: totalCost,           
            profit: finalTotal - totalCost,  
            payment: paymentVal,
            change: paymentMethod === 'cash' ? (paymentVal - finalTotal) : 0,
            type: paymentMethod, 
            customerName: customerName,
            customerId: selectedCustomer ? selectedCustomer.id : null,
            cashier: currentUser.username,
            synced: isOnline 
        };

        const saveToFirebase = async () => {
            const txPromise = addDoc(collection(db, 'transactions'), tx);
            const debtPromise = paymentMethod === 'debt' ? addDoc(collection(db, 'debts'), {
                customerId: selectedCustomer.id,
                customerName: selectedCustomer.name,
                date: new Date().toISOString(),
                amount: finalTotal, 
                type: 'borrow'
            }) : Promise.resolve();

 // KODE BARU (LEBIH AMAN):
            const stockPromises = cart.map(item => {
                // Pastikan item punya ID produk asli
                if (item.original_product?.id) { 
                    const productId = item.original_product.id;
                    const productRef = doc(db, 'products', productId);
                    
                    // Hitung total qty yang mau dikurangi (Qty Beli x Konversi Satuan)
                    const qtyToDeduct = parseInt(item.qty) * (parseInt(item.conversion) || 1);

                    // PENTING: Gunakan increment(-angka) untuk mengurangi
                    // Kita pakai minus (-) karena mau mengurangi stok
                    return updateDoc(productRef, { 
                        stock: increment(-qtyToDeduct) 
                    });
                }
                return Promise.resolve();
            });

            await Promise.all([txPromise, debtPromise, ...stockPromises]);
        };

        try {
            if (!isOnline) {
                saveToFirebase().catch(e => console.log("Background Queue:", e));
                finishTransaction(tx, 'Transaksi Offline Berhasil');
            } else {
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 3000));
                try {
                    await Promise.race([saveToFirebase(), timeoutPromise]);
                    finishTransaction(tx, 'Transaksi Berhasil (Cloud)');
                } catch (error) {
                    if (error.message === 'TIMEOUT') {
                        finishTransaction(tx, 'Koneksi Lambat - Masuk Antrian');
                    } else { throw error; }
                }
            }
        } catch (error) {
            console.error("Critical Error:", error);
            showToast('Gagal: ' + error.message, 'error');
            setIsProcessing(false);
        }
    };

    const finishTransaction = (txData, msg) => {
        // --- UPDATE UI POSVIEW SECARA PAKSA ---
        setLastSuccessItems([...cart]); // Copy keranjang yang berhasil dijual
        // --------------------------------------

        setCart([]);
        setPayModal(false);
        setPayAmount('');
        setDiscountInput('');
        setSelectedCustomer(null);
        setSuccessTx(txData);
        showToast(msg);
        setIsProcessing(false); 
    };

    const selectMethod = (method) => {
        setPaymentMethod(method);
        const currentDisc = calculateDiscountValue();
        const currentTotal = subtotalForPay - currentDisc;

        if (method === 'cash') {
            setPayAmount('');
        } else if (method === 'debt') {
            setPayAmount(0);
        } else {
            setPayAmount(currentTotal);
        }
    };

    useEffect(() => {
        if (payModal && paymentMethod !== 'cash' && paymentMethod !== 'debt') {
            const currentDisc = calculateDiscountValue();
            setPayAmount(subtotalForPay - currentDisc);
        }
    }, [discountInput, discountMode, subtotalForPay, paymentMethod, payModal]);

    const syncPushSmart = async () => {
        const urlItem = paymentConfig.apiUrl; 
        if (!urlItem) return showToast('URL App Script belum diatur!', 'error');
        if (!confirm('Backup ke Google Sheet?')) return;
        setLoading(true);
        try {
            const prodsSnap = await getDocs(collection(db, 'products'));
            const txSnap = await getDocs(collection(db, 'transactions'));
            const allProducts = prodsSnap.docs.map(d => d.data());
            const allTx = txSnap.docs.map(d => d.data());
            const payload = JSON.stringify({ action: 'overwrite_full', products: allProducts, transactions: allTx, expenses: [] });
            await fetch(urlItem, { method: 'POST', body: payload });
            showToast('Backup ke Sheet Sukses!');
        } catch (error) { showToast('Gagal Backup: ' + error.message, 'error'); } finally { setLoading(false); }
    };

    const handleLogout = () => { if (confirm('Yakin ingin keluar?')) { setCurrentUser(null); setView('pos'); } };

    const getMenuItems = () => {
        const isAdmin = currentUser?.role === 'admin';
        const items = [{ id: 'pos', icon: <ShoppingCart />, label: 'Kasir' }];
        if (isAdmin) { items.push({ id: 'dashboard', icon: <LayoutDashboard />, label: 'Dashboard' }, { id: 'inventory', icon: <Package />, label: 'Stok Barang' }); }
        items.push({ id: 'transactions', icon: <FileText />, label: 'Riwayat' });
        if (isAdmin) { items.push({ id: 'reports', icon: <FileBarChart />, label: 'Laporan' }, { id: 'customers', icon: <Users />, label: 'Pelanggan' }); }
        items.push({ id: 'kasbon', icon: <BookUser />, label: 'Kasbon' });
        if (isAdmin) { items.push({ id: 'expenses', icon: <Wallet />, label: 'Pengeluaran' }, { id: 'settings', icon: <Settings />, label: 'Pengaturan' }); }
        return items;
    };

    if (!currentUser) return <LoginView onLogin={(user) => setCurrentUser(user)} />;

    const finalDiscountRp = calculateDiscountValue();
    const finalTotalTagihan = subtotalForPay - finalDiscountRp;

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans text-slate-800">
            <div className="w-16 md:w-64 bg-slate-900 text-white flex flex-col justify-between shadow-xl z-20 h-screen shrink-0 transition-all duration-300">
                 <div>
                    <div className="h-16 flex items-center justify-center md:justify-start md:px-6 border-b border-slate-800 font-bold text-xl tracking-wider text-blue-400 overflow-hidden whitespace-nowrap">
                        <Store className="md:mr-3 shrink-0" />
                        <span className="hidden md:inline">RUKO POS v6</span>
                    </div>
                    <div className={`text-[10px] text-center py-2 font-black tracking-wide ${isOnline ? 'bg-green-600 text-green-100' : 'bg-red-600 text-red-100 animate-pulse'}`}>
                        {isOnline ? <span className="flex items-center justify-center gap-1"><Wifi size={12}/> ONLINE MODE</span> : <span className="flex items-center justify-center gap-1"><WifiOff size={12}/> OFFLINE MODE</span>}
                    </div>

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
                        onProcessPayment={(total) => { setSubtotalForPay(total); setPaymentMethod('cash'); setDiscountMode('rp'); setDiscountInput(''); setPayModal(true); }}
                        activeUser={currentUser} 
                        selectedCustomer={selectedCustomer}
                        setSelectedCustomer={setSelectedCustomer}
                        lastSuccessItems={lastSuccessItems} // <--- KIRIM SINYAL KE KASIR
                    />
                )}
                {view === 'dashboard' && currentUser.role === 'admin' && <DashboardView />}
                {view === 'inventory' && currentUser.role === 'admin' && <InventoryView />}
                {view === 'reports' && currentUser.role === 'admin' && <ReportsView />}
                {view === 'transactions' && <TransactionsView />}
                {view === 'customers' && currentUser.role === 'admin' && <CustomersView />}
                {view === 'kasbon' && <KasbonView />}
                {view === 'expenses' && currentUser.role === 'admin' && <ExpenseView />}
                {view === 'settings' && currentUser.role === 'admin' && <SettingsView />}
                
                {(currentUser.role !== 'admin' && ['dashboard', 'inventory', 'reports', 'expenses', 'settings', 'customers'].includes(view)) && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <Lock size={64} className="mb-4 text-slate-300"/>
                        <h2 className="text-xl font-bold">Akses Ditolak</h2>
                        <p>Menu ini khusus Admin.</p>
                    </div>
                )}
            </main>

            {payModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden anim-scale relative flex flex-col md:flex-row h-[500px] md:h-auto">
                        <button onClick={() => !isProcessing && setPayModal(false)} disabled={isProcessing} className="absolute top-4 right-4 text-slate-400 hover:text-red-400 z-10 disabled:opacity-0"><X className="w-6 h-6"/></button>

                        <div className="w-full md:w-1/3 bg-slate-50 p-4 border-r border-slate-200">
                            <h3 className="font-bold text-slate-700 mb-4">Pilih Metode</h3>
                            <div className="space-y-2">
                                <button onClick={() => !isProcessing && selectMethod('cash')} disabled={isProcessing} className={`w-full p-3 rounded-lg flex items-center gap-3 font-bold transition-all ${paymentMethod === 'cash' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-blue-50 border'}`}>
                                    <Banknote size={20}/> TUNAI (Cash)
                                </button>
                                <button onClick={() => !isProcessing && selectMethod('qris')} disabled={isProcessing} className={`w-full p-3 rounded-lg flex items-center gap-3 font-bold transition-all ${paymentMethod === 'qris' ? 'bg-purple-600 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-purple-50 border'}`}>
                                    <QrCode size={20}/> QRIS Scan
                                </button>
                                <button onClick={() => !isProcessing && selectMethod('transfer')} disabled={isProcessing} className={`w-full p-3 rounded-lg flex items-center gap-3 font-bold transition-all ${paymentMethod === 'transfer' ? 'bg-orange-600 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-orange-50 border'}`}>
                                    <CreditCard size={20}/> TRANSFER BANK
                                </button>
                                <button onClick={() => !isProcessing && selectMethod('debt')} disabled={isProcessing} className={`w-full p-3 rounded-lg flex items-center gap-3 font-bold transition-all ${paymentMethod === 'debt' ? 'bg-red-600 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-red-50 border'}`}>
                                    <BookUser size={20}/> KASBON (Hutang)
                                </button>
                            </div>

                            <div className="mt-4 p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
                                <div className="flex justify-between text-xs text-slate-500 mb-2">
                                    <span>Subtotal</span>
                                    <span>{formatRupiah(subtotalForPay)}</span>
                                </div>
                                <div className="flex p-1 bg-slate-100 rounded-lg mb-2">
                                    <button onClick={() => { setDiscountMode('rp'); setDiscountInput(''); }} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1 ${discountMode === 'rp' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Banknote size={12}/> Rupiah (Rp)</button>
                                    <button onClick={() => { setDiscountMode('percent'); setDiscountInput(''); }} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1 ${discountMode === 'percent' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><BadgePercent size={12}/> Persen (%)</button>
                                </div>
                                <div className="flex items-center gap-2 mb-2">
                                    {discountMode === 'percent' ? <BadgePercent size={14} className="text-orange-500"/> : <Banknote size={14} className="text-blue-500"/>}
                                    <input type="number" value={discountInput} onChange={e => setDiscountInput(e.target.value)} disabled={isProcessing} className={`w-full border-b border-slate-300 text-right text-sm font-bold outline-none bg-transparent placeholder:text-slate-300 placeholder:font-normal ${discountMode === 'percent' ? 'text-orange-500 focus:border-orange-500' : 'text-blue-500 focus:border-blue-500'}`} placeholder={discountMode === 'percent' ? "Contoh: 10 (Artinya 10%)" : "Contoh: 5000"}/>
                                </div>
                                {discountMode === 'percent' && discountInput > 0 && <div className="text-right text-[10px] text-slate-400 italic mb-2">Potongan: - {formatRupiah(finalDiscountRp)}</div>}
                                <div className="border-t border-dashed my-2"></div>
                                <p className="text-xs text-slate-500 mb-1 text-center uppercase tracking-wider font-bold">Total Tagihan</p>
                                <h2 className="text-2xl font-black text-slate-800 text-center animate-pulse">{formatRupiah(finalTotalTagihan)}</h2>
                            </div>
                        </div>

                        <div className="flex-1 p-6 flex flex-col">
                            <div className="flex-1">
                                {paymentMethod === 'cash' && (
                                    <div className="space-y-4">
                                        <h3 className="font-bold text-lg text-slate-700">Pembayaran Tunai</h3>
                                        <div><label className="text-xs font-bold text-slate-500 uppercase">Bayar (Rp)</label><input autoFocus type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} disabled={isProcessing} className="w-full p-3 border-2 border-blue-500 rounded-lg text-xl font-bold text-right focus:outline-none disabled:bg-slate-100 disabled:text-slate-400" placeholder="0" onKeyDown={e => e.key === 'Enter' && handleCheckout()}/></div>
                                        <div className="grid grid-cols-4 gap-2">{[10000, 20000, 50000, 100000].map(m => ( <button key={m} onClick={() => setPayAmount(m)} disabled={isProcessing} className="bg-slate-100 py-2 rounded font-bold text-slate-600 hover:bg-blue-100 disabled:opacity-50">{m/1000}k</button> ))}</div>
                                    </div>
                                )}
                                {paymentMethod === 'qris' && (
                                    <div className="text-center h-full flex flex-col items-center justify-center"><h3 className="font-bold text-lg text-purple-700 mb-2">Scan QRIS</h3>{paymentConfig.qris ? (<img src={paymentConfig.qris} className="w-48 h-48 object-contain border rounded-lg shadow-sm mb-4" alt="QRIS"/>) : (<div className="w-48 h-48 bg-slate-100 rounded flex items-center justify-center text-slate-400 text-xs mb-4">Belum ada QRIS di Setting (Cloud)</div>)}</div>
                                )}
                                {paymentMethod === 'transfer' && (
                                    <div className="text-center h-full flex flex-col items-center justify-center"><h3 className="font-bold text-lg text-orange-700 mb-4">Transfer Bank</h3><div className="bg-orange-50 p-6 rounded-xl border border-orange-100 w-full mb-4"><pre className="text-slate-700 font-bold font-mono whitespace-pre-wrap">{paymentConfig.bank || "Belum ada Info Bank di Setting (Cloud)"}</pre></div></div>
                                )}
                                {paymentMethod === 'debt' && (
                                    <div className="text-center h-full flex flex-col items-center justify-center"><h3 className="font-bold text-lg text-red-700 mb-2">Pencatatan Hutang</h3>{selectedCustomer ? (<div className="bg-red-50 p-4 rounded-xl border border-red-100 w-full mb-4"><p className="text-xs text-slate-500 mb-1">Hutang Atas Nama:</p><h2 className="text-xl font-bold text-slate-800">{selectedCustomer.name}</h2><p className="text-xs text-slate-400 mt-2">Hutang akan disimpan di Cloud.</p></div>) : (<div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 w-full mb-4 flex flex-col items-center gap-2"><AlertCircle className="text-yellow-600"/><p className="text-sm font-bold text-yellow-700">Pelanggan Belum Dipilih!</p><p className="text-xs text-yellow-600">Tutup modal ini, lalu pilih pelanggan di atas keranjang.</p></div>)}</div>
                                )}
                            </div>
                            <button onClick={handleCheckout} disabled={(paymentMethod === 'debt' && !selectedCustomer) || isProcessing} className={`w-full text-white py-4 rounded-xl font-bold text-lg shadow-lg mt-4 flex items-center justify-center gap-2 transition-all ${isProcessing ? 'bg-slate-400 cursor-not-allowed' : paymentMethod === 'cash' ? 'bg-blue-600 hover:bg-blue-700' : paymentMethod === 'qris' ? 'bg-purple-600 hover:bg-purple-700' : paymentMethod === 'debt' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'}`}>{isProcessing ? (<><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/><span>{isOnline ? 'MENYIMPAN...' : 'ANTRIAN OFFLINE...'}</span></>) : (<>{paymentMethod === 'cash' ? 'BAYAR SEKARANG' : paymentMethod === 'debt' ? 'SIMPAN HUTANG' : 'KONFIRMASI SUDAH DIBAYAR'} (Enter)</>)}</button>
                        </div>
                    </div>
                </div>
            )}

            {successTx && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 text-center anim-scale">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4"><Store size={32} /></div>
                        <h3 className="text-xl font-bold mb-1">Transaksi Berhasil!</h3>
                        <div className="mb-6"><span className={`px-3 py-1 rounded-full text-xs font-bold ${successTx.type === 'cash' ? 'bg-blue-100 text-blue-700' : successTx.type === 'qris' ? 'bg-purple-100 text-purple-700' : successTx.type === 'debt' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>VIA {successTx.type.toUpperCase()}</span>{successTx.type === 'cash' && (<p className="text-slate-500 mt-2">Kembali: <span className="font-bold text-slate-800">{formatRupiah(successTx.change)}</span></p>)}</div>
                        <div className="space-y-2"><button onClick={() => printReceipt(successTx)} className="w-full bg-slate-100 text-slate-700 py-3 rounded-lg font-bold border hover:bg-slate-200">Cetak Browser (PC)</button><button onClick={() => printBluetooth(successTx)} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold shadow-lg shadow-blue-200 flex items-center justify-center gap-2 hover:bg-blue-700"><Bluetooth size={18} /> Cetak Bluetooth (HP)</button><button onClick={() => setSuccessTx(null)} className="w-full bg-white text-red-500 py-2 rounded-lg font-bold text-sm hover:underline">Tutup / Transaksi Baru (Esc)</button></div>
                    </div>
                </div>
            )}
            {toast && <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-lg shadow-xl text-white font-medium z-[100] ${toast.type === 'error' ? 'bg-red-600' : 'bg-slate-800'}`}>{toast.message}</div>}
        </div>
    );
}

const X = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>);
export default App;