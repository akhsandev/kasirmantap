import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { formatRupiah } from '../utils';
import { 
    TrendingUp, Wallet, CreditCard, AlertCircle, 
    ArrowUpRight, ArrowDownRight, DollarSign, 
    ShoppingBag, Activity, Calendar, BarChart3, PieChart
} from 'lucide-react';

const DashboardView = () => {
    // State Statistik
    const [stats, setStats] = useState({
        cashInDrawer: 0,    // Uang Fisik di Laci
        digitalMoney: 0,    // Uang di Bank (QRIS/Transfer)
        unpaidDebt: 0,      // Total Piutang Pelanggan
        netProfit: 0,       // Profit Bersih
        expenseTotal: 0,    // Total Pengeluaran
        totalRevenue: 0,    // Omzet Kotor
        txCount: 0          // Jumlah Transaksi
    });

    const [recentTx, setRecentTx] = useState([]);
    const [chartData, setChartData] = useState([]); 
    const [filter, setFilter] = useState('today'); // 'today', 'week', 'month'

    useEffect(() => {
        loadDashboardData();
    }, [filter]);

    const loadDashboardData = async () => {
        // 1. Tentukan Range Waktu
        const now = new Date();
        let startDate = new Date();
        
        if (filter === 'today') {
            startDate.setHours(0, 0, 0, 0);
        } else if (filter === 'week') {
            startDate.setDate(now.getDate() - 7);
        } else if (filter === 'month') {
            startDate.setDate(now.getDate() - 30);
        }

        // 2. Ambil Data
        const [allTx, allExpenses, allDebts] = await Promise.all([
            db.transactions.toArray(),
            db.expenses.toArray(),
            db.debts.toArray()
        ]);

        // 3. Filter Data
        const filteredTx = allTx.filter(t => new Date(t.date) >= startDate);
        const filteredExp = allExpenses.filter(e => new Date(e.date) >= startDate);
        const filteredDebts = allDebts.filter(d => new Date(d.date) >= startDate);

        // --- HITUNG KEUANGAN ---

        // A. KAS FISIK (Uang di Laci)
        const cashSales = filteredTx
            .filter(t => t.type === 'cash')
            .reduce((sum, t) => sum + (t.finalTotal || t.total || 0), 0);
        
        const debtPayments = filteredDebts
            .filter(d => d.type === 'pay')
            .reduce((sum, d) => sum + d.amount, 0);

        const totalExpenses = filteredExp
            .reduce((sum, e) => sum + e.amount, 0);

        const cashInDrawer = (cashSales + debtPayments) - totalExpenses;

        // B. UANG DIGITAL (Rekening)
        const digitalMoney = filteredTx
            .filter(t => t.type === 'qris' || t.type === 'transfer')
            .reduce((sum, t) => sum + (t.finalTotal || t.total || 0), 0);

        // C. PIUTANG (Saldo saat ini)
        const totalBorrowAllTime = allDebts.filter(d => d.type === 'borrow').reduce((s,d) => s + d.amount, 0);
        const totalPayAllTime = allDebts.filter(d => d.type === 'pay').reduce((s,d) => s + d.amount, 0);
        const unpaidDebt = totalBorrowAllTime - totalPayAllTime;

        // D. OMZET & PROFIT
        const totalRevenue = filteredTx.reduce((sum, t) => sum + (t.finalTotal || t.total || 0), 0);
        const grossProfit = filteredTx.reduce((sum, t) => sum + (t.profit || 0), 0);
        const netProfit = grossProfit - totalExpenses;

        setStats({
            cashInDrawer,
            digitalMoney,
            unpaidDebt,
            netProfit,
            expenseTotal: totalExpenses,
            totalRevenue,
            txCount: filteredTx.length
        });

        setRecentTx(allTx.reverse().slice(0, 5));
        prepareChartData(allTx);
    };

    const prepareChartData = (transactions) => {
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            
            const dailyTotal = transactions
                .filter(t => {
                    const tDate = new Date(t.date);
                    return tDate.getDate() === d.getDate() &&
                           tDate.getMonth() === d.getMonth() &&
                           tDate.getFullYear() === d.getFullYear();
                })
                .reduce((sum, t) => sum + (t.finalTotal || t.total || 0), 0);
            
            last7Days.push({ label: dateStr, value: dailyTotal });
        }
        setChartData(last7Days);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 p-6 overflow-y-auto font-sans">
            
            {/* HEADER & FILTER */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <Activity className="text-blue-600"/> Dashboard
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Ringkasan performa bisnis & arus kas Anda.</p>
                </div>
                
                <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 flex">
                    {[{ id: 'today', label: 'Hari Ini' }, { id: 'week', label: '7 Hari' }, { id: 'month', label: '30 Hari' }].map(f => (
                        <button 
                            key={f.id}
                            onClick={() => setFilter(f.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filter === f.id ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* --- BAGIAN 1: KEY METRICS (OMZET, EXPENSE, PROFIT) --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                
                {/* 1. TOTAL OMZET (BIRU) */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-6 shadow-lg shadow-blue-200 transition-transform hover:scale-[1.02]">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <ShoppingBag size={80} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                <ShoppingBag size={18} className="text-white"/>
                            </div>
                            <span className="text-xs font-bold text-blue-100 uppercase tracking-wider">Total Omzet</span>
                        </div>
                        <h2 className="text-3xl font-black tracking-tight">{formatRupiah(stats.totalRevenue)}</h2>
                        <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center text-xs text-blue-50">
                            <span>{stats.txCount} Transaksi Sukses</span>
                            <span className="font-bold flex items-center gap-1"><ArrowUpRight size={12}/> Pendapatan</span>
                        </div>
                    </div>
                </div>

                {/* 2. PENGELUARAN (MERAH) */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white p-6 shadow-lg shadow-red-200 transition-transform hover:scale-[1.02]">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <ArrowDownRight size={80} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                <ArrowDownRight size={18} className="text-white"/>
                            </div>
                            <span className="text-xs font-bold text-rose-100 uppercase tracking-wider">Pengeluaran</span>
                        </div>
                        <h2 className="text-3xl font-black tracking-tight">{formatRupiah(stats.expenseTotal)}</h2>
                        <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center text-xs text-rose-50">
                            <span>Biaya Operasional</span>
                            <span className="font-bold flex items-center gap-1"><ArrowDownRight size={12}/> Keluar</span>
                        </div>
                    </div>
                </div>

                {/* 3. LABA BERSIH (HITAM) */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-black text-white p-6 shadow-lg shadow-slate-400 transition-transform hover:scale-[1.02]">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <TrendingUp size={80} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                <DollarSign size={18} className="text-white"/>
                            </div>
                            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Laba Bersih</span>
                        </div>
                        <h2 className="text-3xl font-black tracking-tight text-emerald-400">{formatRupiah(stats.netProfit)}</h2>
                        <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center text-xs text-slate-300">
                            <span>Omzet - Modal - Biaya</span>
                            <span className="font-bold text-emerald-400 flex items-center gap-1"><TrendingUp size={12}/> Profit</span>
                        </div>
                    </div>
                </div>

            </div>

            {/* --- BAGIAN 2: GRAFIK & LAPORAN KAS --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                
                {/* GRAFIK (SPAN 2) */}
                <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-200 h-[260px] flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <BarChart3 size={18} className="text-blue-600"/> Tren Penjualan (7 Hari)
                        </h3>
                    </div>
                    <div className="flex-1 flex items-end gap-3 px-2">
                        {chartData.map((d, i) => {
                            const maxVal = Math.max(...chartData.map(x => x.value)) || 1;
                            const heightPercent = Math.max((d.value / maxVal) * 100, 5); 
                            
                            return (
                                <div key={i} className="flex-1 flex flex-col justify-end group cursor-pointer relative">
                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-lg font-bold">
                                        {formatRupiah(d.value)}
                                    </div>
                                    <div 
                                        style={{ height: `${heightPercent}%` }} 
                                        className={`w-full rounded-t-lg transition-all duration-500 ${i === chartData.length - 1 ? 'bg-blue-600' : 'bg-blue-100 group-hover:bg-blue-400'}`}
                                    ></div>
                                    <div className="text-[10px] text-slate-400 text-center mt-2 font-medium truncate">
                                        {d.label}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* RINCIAN KAS (VERTIKAL STACK) */}
                <div className="flex flex-col gap-4">
                    
                    {/* KAS LACI */}
                    <div className="flex-1 bg-white p-4 rounded-xl border-l-4 border-emerald-500 shadow-sm flex flex-col justify-center">
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Fisik di Laci</span>
                                <h3 className="text-xl font-bold text-slate-800">{formatRupiah(stats.cashInDrawer)}</h3>
                            </div>
                            <Wallet className="text-emerald-500 opacity-20" size={24}/>
                        </div>
                    </div>

                    {/* REKENING */}
                    <div className="flex-1 bg-white p-4 rounded-xl border-l-4 border-blue-500 shadow-sm flex flex-col justify-center">
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Rekening / Digital</span>
                                <h3 className="text-xl font-bold text-slate-800">{formatRupiah(stats.digitalMoney)}</h3>
                            </div>
                            <CreditCard className="text-blue-500 opacity-20" size={24}/>
                        </div>
                    </div>

                    {/* PIUTANG */}
                    <div className="flex-1 bg-white p-4 rounded-xl border-l-4 border-orange-500 shadow-sm flex flex-col justify-center">
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Piutang Pelanggan</span>
                                <h3 className="text-xl font-bold text-slate-800">{formatRupiah(stats.unpaidDebt)}</h3>
                            </div>
                            <AlertCircle className="text-orange-500 opacity-20" size={24}/>
                        </div>
                    </div>

                </div>
            </div>

            {/* --- BAGIAN 3: TRANSAKSI TERBARU --- */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1">
                <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                        <Calendar size={16}/> Transaksi Terakhir
                    </h3>
                    <span className="text-xs text-slate-400 font-medium">Real-time update</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white text-slate-500 font-bold uppercase text-[10px] border-b">
                            <tr>
                                <th className="px-6 py-3">Waktu</th>
                                <th className="px-6 py-3">Pelanggan</th>
                                <th className="px-6 py-3 text-center">Metode</th>
                                <th className="px-6 py-3 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {recentTx.length === 0 && (
                                <tr><td colSpan="4" className="text-center py-8 text-slate-400 italic">Belum ada transaksi hari ini.</td></tr>
                            )}
                            {recentTx.map(tx => (
                                <tr key={tx.id} className="hover:bg-blue-50/50 transition-colors">
                                    <td className="px-6 py-3 text-slate-600 font-mono text-xs">{new Date(tx.date).toLocaleTimeString('id-ID')}</td>
                                    <td className="px-6 py-3 font-medium text-slate-700">{tx.customerName || 'Umum'}</td>
                                    <td className="px-6 py-3 text-center">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                            tx.type === 'cash' ? 'bg-emerald-100 text-emerald-700' :
                                            tx.type === 'debt' ? 'bg-orange-100 text-orange-700' :
                                            'bg-blue-100 text-blue-700'
                                        }`}>{tx.type === 'debt' ? 'Kasbon' : tx.type}</span>
                                    </td>
                                    <td className="px-6 py-3 text-right font-bold text-slate-800">{formatRupiah(tx.finalTotal)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default DashboardView;