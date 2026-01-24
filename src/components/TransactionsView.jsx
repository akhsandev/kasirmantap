import React, { useState, useEffect } from 'react';
// MIGRASI FIREBASE
// Tambahkan 'where' untuk filter tanggal
import { db, collection, getDocs, query, orderBy, limit, where } from '../firebase';
import { formatRupiah, printReceipt, printBluetooth } from '../utils';
import { FileText, Search, Printer, Calendar, Bluetooth, Filter, RefreshCw } from 'lucide-react';

const TransactionsView = () => {
    const [transactions, setTransactions] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    // STATE BARU: Filter Tanggal
    // Default: Hari ini
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        loadTransactions();
    }, []);

    const loadTransactions = async () => {
        setLoading(true);
        try {
            // LOGIKA BARU: Ambil data berdasarkan RENTANG TANGGAL
            // Ini mengatasi masalah "Data Lama Tidak Ketemu" dan "Aplikasi Lemot"
            
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0); // Mulai jam 00:00

            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999); // Sampai jam 23:59

            const q = query(
                collection(db, 'transactions'), 
                where('date', '>=', start.toISOString()), // Dari Tanggal X
                where('date', '<=', end.toISOString()),   // Sampai Tanggal Y
                orderBy('date', 'desc'),
                limit(500) // Batasi 500 per tarikan agar browser tidak crash
            );

            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTransactions(data);
            
            if (data.length === 0) {
                // Opsional: Beri tahu user kalau kosong
                // console.log("Tidak ada data di tanggal ini");
            }

        } catch (error) {
            console.error("Error loading tx:", error);
            alert("Gagal memuat riwayat. Cek koneksi internet.");
        } finally {
            setLoading(false);
        }
    };

    // Filter lokal untuk pencarian nama (di dalam data yang sudah ditarik)
    const filtered = transactions.filter(t => 
        (t.id && t.id.toLowerCase().includes(search.toLowerCase())) ||
        (t.customerName && t.customerName.toLowerCase().includes(search.toLowerCase()))
    );

    // Hitung Total Omzet pada tampilan saat ini
    const totalOmzetView = filtered.reduce((acc, curr) => acc + (curr.finalTotal || 0), 0);

    return (
        <div className="flex flex-col h-full bg-slate-50 p-6 overflow-hidden">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2"><FileText className="text-blue-600"/> Riwayat Transaksi</h1>
                    <p className="text-slate-500 text-sm">Data tersimpan aman di Cloud.</p>
                </div>
                
                {/* INFO TOTAL OMZET (Fitur Tambahan) */}
                <div className="bg-blue-600 text-white px-5 py-2 rounded-xl shadow-lg shadow-blue-200">
                    <p className="text-[10px] uppercase font-bold opacity-80">Total Tampil</p>
                    <p className="text-xl font-black">{formatRupiah(totalOmzetView)}</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col flex-1 overflow-hidden">
                {/* AREA FILTER TANGGAL (PENTING UNTUK POIN 3) */}
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 items-center bg-slate-50/50">
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:flex-none">
                            <span className="absolute left-3 top-2.5 text-[10px] font-bold text-slate-400">DARI</span>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="pl-12 pr-3 py-2 border rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-blue-500 w-full md:w-40" />
                        </div>
                        <span className="text-slate-400 font-bold">-</span>
                        <div className="relative flex-1 md:flex-none">
                            <span className="absolute left-3 top-2.5 text-[10px] font-bold text-slate-400">SAMPAI</span>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="pl-14 pr-3 py-2 border rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-blue-500 w-full md:w-40" />
                        </div>
                        <button onClick={loadTransactions} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-lg transition-all shadow-md active:scale-95 disabled:opacity-50">
                            {loading ? <RefreshCw size={18} className="animate-spin"/> : <Filter size={18}/>}
                        </button>
                    </div>

                    <div className="w-px h-8 bg-slate-200 hidden md:block"></div>

                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={18}/>
                        <input value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 outline-none text-sm" placeholder="Cari ID / Nama pelanggan di data ini..." />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
                            <RefreshCw className="animate-spin text-blue-500"/>
                            <span className="text-xs font-bold">Sedang mengambil data dari Cloud...</span>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-4">Waktu</th>
                                    <th className="px-6 py-4">Pelanggan</th>
                                    <th className="px-6 py-4">Items</th>
                                    <th className="px-6 py-4">Total</th>
                                    <th className="px-6 py-4">Metode</th>
                                    <th className="px-6 py-4 text-center">Cetak</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.map(t => (
                                    <tr key={t.id} className="hover:bg-blue-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-700">{new Date(t.date).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</div>
                                            <div className="text-xs text-slate-400 flex items-center gap-1"><Calendar size={10}/> {new Date(t.date).toLocaleDateString('id-ID')}</div>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-700">{t.customerName || 'Umum'}</td>
                                        <td className="px-6 py-4 text-slate-600">
                                            <span className="font-bold">{t.items.length} Barang</span>
                                            <div className="text-[10px] text-slate-400 truncate max-w-[150px]">{t.items.map(i=>i.name).join(', ')}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-black text-slate-800">{formatRupiah(t.finalTotal)}</div>
                                            {t.discount > 0 && <div className="text-[10px] text-red-500 font-bold bg-red-50 px-1 rounded w-fit">Disc: {formatRupiah(t.discount)}</div>}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${
                                                t.type === 'cash' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                                                t.type === 'debt' ? 'bg-red-50 text-red-700 border-red-200' :
                                                t.type === 'qris' ? 'bg-purple-50 text-purple-700 border-purple-200' : 
                                                'bg-orange-50 text-orange-700 border-orange-200'
                                            }`}>{t.type}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center gap-2 opacity-80 group-hover:opacity-100">
                                                <button onClick={() => printReceipt(t)} className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg border border-transparent hover:border-slate-300 transition-all" title="Cetak PC"><Printer size={16}/></button>
                                                <button onClick={() => printBluetooth(t)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg border border-transparent hover:border-blue-200 transition-all" title="Cetak HP"><Bluetooth size={16}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    {!loading && filtered.length === 0 && (
                        <div className="p-10 text-center flex flex-col items-center justify-center opacity-50">
                            <FileText size={48} className="text-slate-300 mb-2"/>
                            <p className="text-slate-500 font-bold">Tidak ada transaksi ditemukan.</p>
                            <p className="text-xs text-slate-400">Coba atur ulang tanggal filter di atas.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TransactionsView;