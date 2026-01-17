import React, { useState, useEffect } from 'react';
// MIGRASI FIREBASE
import { db, collection, getDocs, query, orderBy, limit } from '../firebase';
import { formatRupiah, printReceipt, printBluetooth } from '../utils';
import { FileText, Search, Printer, Calendar, ArrowUpRight, ArrowDownLeft, Bluetooth } from 'lucide-react';

const TransactionsView = () => {
    const [transactions, setTransactions] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadTransactions();
    }, []);

    const loadTransactions = async () => {
        setLoading(true);
        try {
            // Ambil 100 Transaksi Terakhir dari Cloud
            const q = query(
                collection(db, 'transactions'), 
                orderBy('date', 'desc'), 
                limit(100)
            );
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTransactions(data);
        } catch (error) {
            console.error("Error loading tx:", error);
            alert("Gagal memuat riwayat dari Cloud.");
        } finally {
            setLoading(false);
        }
    };

    const filtered = transactions.filter(t => 
        (t.id && t.id.toLowerCase().includes(search.toLowerCase())) ||
        (t.customerName && t.customerName.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="flex flex-col h-full bg-slate-50 p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2"><FileText className="text-blue-600"/> Riwayat Transaksi</h1>
                    <p className="text-slate-500 text-sm">Data penjualan tersimpan di Firebase Cloud.</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col flex-1 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-3 text-slate-400" size={18}/>
                        <input value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 outline-none" placeholder="Cari ID transaksi / nama pelanggan..." />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-40 text-slate-400">Memuat data dari Cloud...</div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs sticky top-0">
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
                                    <tr key={t.id} className="hover:bg-blue-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-700">{new Date(t.date).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</div>
                                            <div className="text-xs text-slate-400">{new Date(t.date).toLocaleDateString('id-ID')}</div>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-700">{t.customerName || 'Umum'}</td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {t.items.length} Barang
                                            <div className="text-[10px] text-slate-400 truncate max-w-[150px]">{t.items.map(i=>i.name).join(', ')}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-black text-slate-800">{formatRupiah(t.finalTotal)}</div>
                                            {t.discount > 0 && <div className="text-[10px] text-red-500">Disc: {formatRupiah(t.discount)}</div>}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                                t.type === 'cash' ? 'bg-blue-100 text-blue-700' : 
                                                t.type === 'debt' ? 'bg-red-100 text-red-700' :
                                                t.type === 'qris' ? 'bg-purple-100 text-purple-700' : 
                                                'bg-orange-100 text-orange-700'
                                            }`}>{t.type}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => printReceipt(t)} className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg" title="Cetak PC"><Printer size={16}/></button>
                                                <button onClick={() => printBluetooth(t)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg" title="Cetak HP"><Bluetooth size={16}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    {!loading && filtered.length === 0 && <div className="p-8 text-center text-slate-400">Belum ada transaksi di Cloud.</div>}
                </div>
            </div>
        </div>
    );
};

export default TransactionsView;