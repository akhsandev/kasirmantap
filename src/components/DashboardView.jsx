import React, { useState, useEffect } from 'react';
// MIGRASI FIREBASE
import { db, collection, getDocs, query, orderBy } from '../firebase';
import { LayoutDashboard, TrendingUp, TrendingDown, DollarSign, Wallet } from 'lucide-react';
import { formatRupiah } from '../utils';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const DashboardView = () => {
    const [stats, setStats] = useState({
        revenue: 0,
        profit: 0,
        expenses: 0,
        netProfit: 0,
        txCount: 0
    });
    const [chartData, setChartData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        setLoading(true);
        try {
            // 1. Ambil Data Transaksi & Pengeluaran dari Cloud
            // (Catatan: Di aplikasi besar, sebaiknya pakai Cloud Functions untuk hitung ini biar hemat kuota read)
            const txSnap = await getDocs(collection(db, 'transactions'));
            const expSnap = await getDocs(collection(db, 'expenses'));

            const transactions = txSnap.docs.map(d => d.data());
            const expenses = expSnap.docs.map(d => d.data());

            // 2. Hitung Total
            let rev = 0;
            let prof = 0;
            let exp = 0;

            transactions.forEach(t => {
                rev += (parseInt(t.finalTotal) || 0);
                prof += (parseInt(t.profit) || 0);
            });

            expenses.forEach(e => {
                exp += (parseInt(e.amount) || 0);
            });

            setStats({
                revenue: rev,
                profit: prof,
                expenses: exp,
                netProfit: prof - exp,
                txCount: transactions.length
            });

            // 3. Siapkan Data Grafik (7 Hari Terakhir)
            const last7Days = [...Array(7)].map((_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - i);
                return d.toISOString().split('T')[0];
            }).reverse();

            const chartValues = last7Days.map(dateStr => {
                // Filter transaksi per hari
                const dayTx = transactions.filter(t => t.date.startsWith(dateStr));
                return dayTx.reduce((sum, t) => sum + (parseInt(t.finalTotal) || 0), 0);
            });

            setChartData({
                labels: last7Days.map(d => new Date(d).toLocaleDateString('id-ID', {weekday:'short', day:'numeric'})),
                datasets: [
                    {
                        label: 'Omzet Harian',
                        data: chartValues,
                        backgroundColor: 'rgba(59, 130, 246, 0.5)',
                        borderColor: 'rgb(59, 130, 246)',
                        borderWidth: 1,
                        borderRadius: 5,
                    },
                ],
            });

        } catch (error) {
            console.error("Gagal load dashboard:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="h-full flex items-center justify-center text-slate-400">Sedang menghitung data Cloud...</div>;

    return (
        <div className="flex flex-col h-full bg-slate-50 p-6 overflow-y-auto">
            <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 mb-6"><LayoutDashboard className="text-blue-600"/> Dashboard (Realtime)</h1>

            {/* KARTU STATISTIK */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><DollarSign size={20}/></div>
                        <span className="text-slate-500 font-bold text-sm">Total Omzet</span>
                    </div>
                    <div className="text-2xl font-black text-slate-800">{formatRupiah(stats.revenue)}</div>
                    <div className="text-xs text-slate-400 mt-1">{stats.txCount} Transaksi</div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-green-100 text-green-600 rounded-lg"><TrendingUp size={20}/></div>
                        <span className="text-slate-500 font-bold text-sm">Laba Kotor</span>
                    </div>
                    <div className="text-2xl font-black text-green-600">{formatRupiah(stats.profit)}</div>
                    <div className="text-xs text-slate-400 mt-1">Margin Penjualan</div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-red-100 text-red-600 rounded-lg"><Wallet size={20}/></div>
                        <span className="text-slate-500 font-bold text-sm">Pengeluaran</span>
                    </div>
                    <div className="text-2xl font-black text-red-600">{formatRupiah(stats.expenses)}</div>
                    <div className="text-xs text-slate-400 mt-1">Operasional Toko</div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><TrendingDown size={20}/></div>
                        <span className="text-slate-500 font-bold text-sm">Laba Bersih</span>
                    </div>
                    <div className="text-2xl font-black text-purple-600">{formatRupiah(stats.netProfit)}</div>
                    <div className="text-xs text-slate-400 mt-1">Omzet - Modal - Beban</div>
                </div>
            </div>

            {/* GRAFIK */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex-1 min-h-[300px]">
                <h3 className="font-bold text-slate-700 mb-4">Grafik Penjualan (7 Hari Terakhir)</h3>
                {chartData && (
                    <div className="w-full h-full">
                        <Bar options={{ responsive: true, maintainAspectRatio: false }} data={chartData} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default DashboardView;