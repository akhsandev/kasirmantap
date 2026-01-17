import React, { useState } from 'react';
import { db } from '../db';
import { generateExcelReport } from '../utils';
import { 
    FileBarChart, FileText, ShoppingBag, Package, 
    Layers, Wallet, TrendingUp, CreditCard, Download 
} from 'lucide-react';

const ReportsView = () => {
    const [loading, setLoading] = useState(false);

    // --- LOGIKA SETIAP LAPORAN ---
    
    // 1. Laporan Transaksi (Detail)
    const downloadTransactions = async () => {
        setLoading(true);
        const txs = await db.transactions.toArray();
        const data = txs.map(t => ({
            id: t.id,
            date: new Date(t.date).toLocaleDateString('id-ID'),
            time: new Date(t.date).toLocaleTimeString('id-ID'),
            cust: t.customerName,
            type: t.type,
            total: t.finalTotal,
            profit: t.profit || 0,
            cashier: t.cashier || '-'
        }));
        
        await generateExcelReport(
            'Data Transaksi',
            [
                { header: 'No Ref', key: 'id', width: 10 },
                { header: 'Tanggal', key: 'date', width: 15 },
                { header: 'Jam', key: 'time', width: 10 },
                { header: 'Pelanggan', key: 'cust', width: 20 },
                { header: 'Metode', key: 'type', width: 10 },
                { header: 'Total', key: 'total', width: 15 },
                { header: 'Profit', key: 'profit', width: 15 },
                { header: 'Kasir', key: 'cashier', width: 15 },
            ],
            data,
            'Laporan_Transaksi'
        );
        setLoading(false);
    };

    // 2. Laporan Produk Terjual (Analisa Laris)
    const downloadSoldProducts = async () => {
        setLoading(true);
        const txs = await db.transactions.toArray();
        const productStats = {};

        // Loop semua transaksi -> semua item
        txs.forEach(tx => {
            tx.items.forEach(item => {
                if (!productStats[item.name]) {
                    productStats[item.name] = { qty: 0, revenue: 0, profit: 0 };
                }
                productStats[item.name].qty += item.qty;
                productStats[item.name].revenue += (item.price * item.qty);
                // Hitung estimasi profit per item (jika ada data modal)
                const cost = (item.cost_at_sale || 0) * item.qty * (item.conversion||1);
                productStats[item.name].profit += ((item.price * item.qty) - cost);
            });
        });

        // Convert ke Array & Sort dari yang paling laris
        const data = Object.keys(productStats).map(name => ({
            name: name,
            qty: productStats[name].qty,
            revenue: productStats[name].revenue,
            profit: productStats[name].profit
        })).sort((a, b) => b.qty - a.qty);

        await generateExcelReport(
            'Produk Terjual',
            [
                { header: 'Nama Produk', key: 'name', width: 40 },
                { header: 'Terjual (Qty)', key: 'qty', width: 15 },
                { header: 'Total Omzet', key: 'revenue', width: 20 },
                { header: 'Est. Profit', key: 'profit', width: 20 },
            ],
            data,
            'Laporan_Produk_Terjual'
        );
        setLoading(false);
    };

    // 3. Laporan Stok Produk (Aset)
    const downloadStock = async () => {
        setLoading(true);
        const products = await db.products.toArray();
        const data = products.map(p => ({
            code: p.barcode,
            name: p.name,
            cat: p.category,
            stock: p.stock,
            cost: p.cost_price,
            asset: p.stock * p.cost_price // Nilai Aset
        }));

        await generateExcelReport(
            'Stok Gudang',
            [
                { header: 'Barcode', key: 'code', width: 15 },
                { header: 'Nama Barang', key: 'name', width: 35 },
                { header: 'Kategori', key: 'cat', width: 15 },
                { header: 'Sisa Stok', key: 'stock', width: 10 },
                { header: 'Modal (HPP)', key: 'cost', width: 15 },
                { header: 'Nilai Aset', key: 'asset', width: 20 },
            ],
            data,
            'Laporan_Stok_Aset'
        );
        setLoading(false);
    };

    // 4. Laporan Kategori (Sebaran)
    const downloadCategory = async () => {
        setLoading(true);
        const products = await db.products.toArray();
        const catStats = {};

        products.forEach(p => {
            const c = p.category || 'Tanpa Kategori';
            if (!catStats[c]) catStats[c] = { count: 0, stock: 0, asset: 0 };
            catStats[c].count += 1;
            catStats[c].stock += p.stock;
            catStats[c].asset += (p.stock * p.cost_price);
        });

        const data = Object.keys(catStats).map(c => ({
            name: c,
            count: catStats[c].count,
            stock: catStats[c].stock,
            asset: catStats[c].asset
        }));

        await generateExcelReport(
            'Analisa Kategori',
            [
                { header: 'Kategori', key: 'name', width: 25 },
                { header: 'Jml Jenis Produk', key: 'count', width: 15 },
                { header: 'Total Fisik Stok', key: 'stock', width: 15 },
                { header: 'Nilai Aset', key: 'asset', width: 20 },
            ],
            data,
            'Laporan_Kategori'
        );
        setLoading(false);
    };

    // 5. Laporan Pengeluaran
    const downloadExpenses = async () => {
        setLoading(true);
        const exps = await db.expenses.toArray();
        const data = exps.map(e => ({
            date: new Date(e.date).toLocaleDateString('id-ID'),
            desc: e.desc,
            amount: e.amount
        }));

        await generateExcelReport(
            'Pengeluaran',
            [
                { header: 'Tanggal', key: 'date', width: 15 },
                { header: 'Keterangan', key: 'desc', width: 40 },
                { header: 'Jumlah', key: 'amount', width: 20 },
            ],
            data,
            'Laporan_Pengeluaran'
        );
        setLoading(false);
    };

    // 6. Laporan Hasil (Laba Rugi Sederhana Harian)
    const downloadProfitLoss = async () => {
        setLoading(true);
        const txs = await db.transactions.toArray();
        const exps = await db.expenses.toArray();
        
        // Group by Date
        const daily = {};
        
        // Proses Transaksi
        txs.forEach(t => {
            const d = new Date(t.date).toLocaleDateString('id-ID');
            if(!daily[d]) daily[d] = { omzet: 0, modal: 0, expense: 0 };
            daily[d].omzet += t.finalTotal;
            daily[d].modal += (t.total_cost || 0);
        });

        // Proses Pengeluaran
        exps.forEach(e => {
            const d = new Date(e.date).toLocaleDateString('id-ID');
            if(!daily[d]) daily[d] = { omzet: 0, modal: 0, expense: 0 };
            daily[d].expense += e.amount;
        });

        const data = Object.keys(daily).map(d => ({
            date: d,
            omzet: daily[d].omzet,
            modal: daily[d].modal,
            gross: daily[d].omzet - daily[d].modal,
            expense: daily[d].expense,
            net: (daily[d].omzet - daily[d].modal) - daily[d].expense
        }));

        await generateExcelReport(
            'Laba Rugi Harian',
            [
                { header: 'Tanggal', key: 'date', width: 15 },
                { header: 'Omzet Penjualan', key: 'omzet', width: 20 },
                { header: 'Modal Barang (HPP)', key: 'modal', width: 20 },
                { header: 'Laba Kotor', key: 'gross', width: 20 },
                { header: 'Pengeluaran Ops', key: 'expense', width: 20 },
                { header: 'LABA BERSIH', key: 'net', width: 20 },
            ],
            data,
            'Laporan_Hasil_Laba'
        );
        setLoading(false);
    };

    // 7. Laporan Metode Bayar
    const downloadPaymentMethods = async () => {
        setLoading(true);
        const txs = await db.transactions.toArray();
        const stats = { cash: 0, qris: 0, transfer: 0, debt: 0 };

        txs.forEach(t => {
            if (stats[t.type] !== undefined) {
                stats[t.type] += t.finalTotal;
            }
        });

        const data = [
            { method: 'TUNAI (Cash)', total: stats.cash },
            { method: 'QRIS (Scan)', total: stats.qris },
            { method: 'TRANSFER BANK', total: stats.transfer },
            { method: 'KASBON (Hutang)', total: stats.debt },
        ];

        await generateExcelReport(
            'Metode Pembayaran',
            [
                { header: 'Metode', key: 'method', width: 30 },
                { header: 'Total Nilai Masuk', key: 'total', width: 25 },
            ],
            data,
            'Laporan_Metode_Bayar'
        );
        setLoading(false);
    };

    // 8. Export Semua (Sama kayak Transaksi tapi untuk arsip)
    const downloadFullExport = async () => {
        // Kita pakai fungsi transaksi saja, karena user minta "Export Data Transaksi ke Excel"
        downloadTransactions();
    };

    // --- UI CONFIG ---
    const reports = [
        { title: 'Laporan Transaksi', desc: 'Detail semua riwayat penjualan', icon: <FileText size={24}/>, color: 'bg-blue-500', action: downloadTransactions },
        { title: 'Produk Terjual', desc: 'Analisa barang terlaris', icon: <ShoppingBag size={24}/>, color: 'bg-emerald-500', action: downloadSoldProducts },
        { title: 'Stok Produk', desc: 'Sisa stok & nilai aset gudang', icon: <Package size={24}/>, color: 'bg-indigo-500', action: downloadStock },
        { title: 'Laporan Kategori', desc: 'Sebaran produk per kategori', icon: <Layers size={24}/>, color: 'bg-purple-500', action: downloadCategory },
        { title: 'Laporan Pengeluaran', desc: 'Daftar biaya operasional', icon: <Wallet size={24}/>, color: 'bg-red-500', action: downloadExpenses },
        { title: 'Laporan Hasil', desc: 'Laba Rugi Harian (Omzet - Biaya)', icon: <TrendingUp size={24}/>, color: 'bg-slate-800', action: downloadProfitLoss },
        { title: 'Metode Bayar', desc: 'Analisa Cash vs QRIS vs Transfer', icon: <CreditCard size={24}/>, color: 'bg-orange-500', action: downloadPaymentMethods },
        { title: 'Export Transaksi Excel', desc: 'Download data mentah untuk arsip', icon: <Download size={24}/>, color: 'bg-teal-600', action: downloadFullExport },
    ];

    return (
        <div className="flex flex-col h-full bg-slate-50 p-6 overflow-y-auto font-sans">
            <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3 mb-2">
                <FileBarChart className="text-blue-600"/> Pusat Laporan
            </h1>
            <p className="text-slate-500 text-sm mb-8">Unduh data bisnis Anda ke dalam format Excel (.xlsx) untuk analisa lebih lanjut.</p>

            {loading && (
                <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-xl shadow-xl flex flex-col items-center animate-pulse">
                        <Download size={48} className="text-blue-600 mb-4"/>
                        <h3 className="font-bold text-lg">Sedang Membuat Excel...</h3>
                        <p className="text-slate-500 text-sm">Mohon tunggu sebentar</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {reports.map((item, idx) => (
                    <button 
                        key={idx} 
                        onClick={item.action}
                        disabled={loading}
                        className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-xl hover:border-blue-200 hover:-translate-y-1 transition-all text-left flex flex-col justify-between group h-40"
                    >
                        <div className="flex justify-between items-start">
                            <div className={`p-3 rounded-xl text-white shadow-lg ${item.color} group-hover:scale-110 transition-transform`}>
                                {item.icon}
                            </div>
                            <Download size={20} className="text-slate-300 group-hover:text-blue-500"/>
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-700 text-lg group-hover:text-blue-700">{item.title}</h3>
                            <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default ReportsView;