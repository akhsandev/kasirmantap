import React, { useState } from 'react';
// MIGRASI FIREBASE
import { db, collection, getDocs, query, orderBy } from '../firebase';
import { FileBarChart, Download, FileSpreadsheet } from 'lucide-react';
import { generateExcelReport } from '../utils'; // Helper Excel tetap sama

const ReportsView = () => {
    const [loading, setLoading] = useState(false);

    // FUNGSI UTAMA: TARIK DATA CLOUD LALU DOWNLOAD
    const handleDownload = async (type) => {
        if(!confirm(`Download Laporan ${type}?`)) return;
        setLoading(true);
        
        try {
            // LOAD DATA DARI CLOUD
            const txSnap = await getDocs(query(collection(db, 'transactions'), orderBy('date', 'desc')));
            const prodSnap = await getDocs(collection(db, 'products'));
            const expSnap = await getDocs(collection(db, 'expenses'));
            
            const transactions = txSnap.docs.map(d => d.data());
            const products = prodSnap.docs.map(d => d.data());
            const expenses = expSnap.docs.map(d => d.data());

            // LOGIKA LAPORAN (Sama seperti versi Offline, hanya sumber datanya beda)
            if (type === 'TRANSAKSI') {
                const data = transactions.map(t => ({
                    Tanggal: new Date(t.date).toLocaleString('id-ID'),
                    Pelanggan: t.customerName,
                    Total: t.total,
                    Diskon: t.discount,
                    Final: t.finalTotal,
                    Modal: t.total_cost || 0,
                    Laba: t.profit || 0,
                    Metode: t.type,
                    Kasir: t.cashier
                }));
                await generateExcelReport('Transaksi', 
                    [{header:'Tanggal', key:'Tanggal'}, {header:'Pelanggan', key:'Pelanggan'}, {header:'Total', key:'Total'}, {header:'Diskon', key:'Diskon'}, {header:'Final', key:'Final'}, {header:'Modal', key:'Modal'}, {header:'Laba', key:'Laba'}, {header:'Metode', key:'Metode'}, {header:'Kasir', key:'Kasir'}], 
                    data, 'Laporan_Transaksi'
                );
            } 
            else if (type === 'STOK') {
                const data = products.map(p => ({
                    Barcode: p.barcode,
                    Nama: p.name,
                    Kategori: p.category,
                    Stok: p.stock,
                    Modal: p.cost_price,
                    Jual: p.price,
                    Aset: (p.stock * p.cost_price)
                }));
                await generateExcelReport('Stok', 
                    [{header:'Barcode', key:'Barcode'}, {header:'Nama', key:'Nama'}, {header:'Kategori', key:'Kategori'}, {header:'Stok', key:'Stok'}, {header:'Modal', key:'Modal'}, {header:'Jual', key:'Jual'}, {header:'Nilai Aset', key:'Aset'}], 
                    data, 'Laporan_Stok'
                );
            }
            else if (type === 'LARIS') {
                // Analisa Produk Terlaris
                let sales = {};
                transactions.forEach(t => {
                    t.items.forEach(item => {
                        if (!sales[item.name]) sales[item.name] = 0;
                        sales[item.name] += item.qty * (item.conversion || 1);
                    });
                });
                const data = Object.entries(sales)
                    .map(([name, qty]) => ({ Nama: name, Terjual: qty }))
                    .sort((a,b) => b.Terjual - a.Terjual);
                
                await generateExcelReport('Terlaris', 
                    [{header:'Nama Produk', key:'Nama'}, {header:'Qty Terjual', key:'Terjual'}], 
                    data, 'Laporan_Produk_Terlaris'
                );
            }
            else if (type === 'PENGELUARAN') {
                const data = expenses.map(e => ({
                    Tanggal: new Date(e.date).toLocaleDateString('id-ID'),
                    Keterangan: e.desc,
                    Jumlah: e.amount
                }));
                await generateExcelReport('Pengeluaran',
                    [{header:'Tanggal', key:'Tanggal'}, {header:'Keterangan', key:'Keterangan'}, {header:'Jumlah', key:'Jumlah'}],
                    data, 'Laporan_Pengeluaran'
                );
            }
            else if (type === 'LABARUGI') {
                // Laba Rugi Sederhana
                let totalRev = 0, totalCost = 0, totalExp = 0;
                transactions.forEach(t => { totalRev += t.finalTotal; totalCost += t.total_cost; });
                expenses.forEach(e => { totalExp += e.amount; });
                
                const data = [
                    { Item: 'Total Pendapatan (Omzet)', Nilai: totalRev },
                    { Item: 'Total Modal Barang (HPP)', Nilai: totalCost },
                    { Item: 'Laba Kotor', Nilai: totalRev - totalCost },
                    { Item: '', Nilai: '' },
                    { Item: 'Total Pengeluaran Operasional', Nilai: totalExp },
                    { Item: '', Nilai: '' },
                    { Item: 'LABA BERSIH (NET PROFIT)', Nilai: (totalRev - totalCost) - totalExp },
                ];
                await generateExcelReport('LabaRugi', [{header:'Uraian', key:'Item'}, {header:'Nilai (Rp)', key:'Nilai'}], data, 'Laporan_Laba_Rugi');
            }

        } catch (e) {
            alert("Gagal download: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 p-6 overflow-hidden">
            <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 mb-6"><FileBarChart className="text-blue-600"/> Pusat Laporan (Cloud)</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <ReportCard title="Laporan Transaksi" desc="Detail semua riwayat penjualan" icon={<FileSpreadsheet/>} onClick={() => handleDownload('TRANSAKSI')} loading={loading} color="blue" />
                <ReportCard title="Produk Terlaris" desc="Analisa barang paling laku" icon={<FileSpreadsheet/>} onClick={() => handleDownload('LARIS')} loading={loading} color="green" />
                <ReportCard title="Stok & Aset" desc="Sisa stok dan nilai aset gudang" icon={<FileSpreadsheet/>} onClick={() => handleDownload('STOK')} loading={loading} color="orange" />
                <ReportCard title="Laporan Pengeluaran" desc="Detail biaya operasional" icon={<FileSpreadsheet/>} onClick={() => handleDownload('PENGELUARAN')} loading={loading} color="red" />
                <ReportCard title="Laba Rugi" desc="Ringkasan Profit & Loss" icon={<FileSpreadsheet/>} onClick={() => handleDownload('LABARUGI')} loading={loading} color="purple" />
            </div>

            {loading && <div className="mt-8 text-center text-blue-600 font-bold animate-pulse">Sedang mengambil data dari Cloud & Membuat Excel...</div>}
        </div>
    );
};

const ReportCard = ({ title, desc, icon, onClick, loading, color }) => (
    <button onClick={onClick} disabled={loading} className={`bg-white p-6 rounded-xl shadow-sm border border-slate-200 text-left hover:shadow-md hover:border-${color}-500 transition-all group disabled:opacity-50`}>
        <div className={`w-12 h-12 rounded-lg bg-${color}-50 text-${color}-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>{icon}</div>
        <h3 className="font-bold text-slate-800 text-lg">{title}</h3>
        <p className="text-xs text-slate-400 mt-1">{desc}</p>
        <div className={`mt-4 text-xs font-bold text-${color}-600 flex items-center gap-1`}>Download Excel <Download size={12}/></div>
    </button>
);

export default ReportsView;