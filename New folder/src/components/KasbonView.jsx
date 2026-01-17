import React, { useState, useEffect } from 'react';
// MIGRASI FIREBASE
import { db, collection, getDocs, updateDoc, deleteDoc, doc, query, orderBy } from '../firebase';
import { BookUser, Search, Trash2, CheckCircle, Clock } from 'lucide-react';
import { formatRupiah } from '../utils';

const KasbonView = () => {
    const [debts, setDebts] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => { loadDebts(); }, []);

    const loadDebts = async () => {
        setLoading(true);
        try {
            // Ambil semua data hutang dari Cloud
            const q = query(collection(db, 'debts'), orderBy('date', 'desc'));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setDebts(data);
        } catch (e) {
            console.error("Gagal load kasbon:", e);
        } finally {
            setLoading(false);
        }
    };

    // LOGIKA PELUNASAN (Update Cloud)
    const handlePay = async (item) => {
        const payStr = prompt(`Sisa Hutang: ${formatRupiah(item.amount)}\nMasukkan jumlah pembayaran:`);
        if (!payStr) return;

        const payVal = parseInt(payStr);
        if (isNaN(payVal) || payVal <= 0) return alert('Jumlah tidak valid!');

        const newAmount = item.amount - payVal;

        try {
            const ref = doc(db, 'debts', item.id);
            if (newAmount <= 0) {
                // LUNAS -> Hapus data atau tandai lunas (Kita hapus saja biar bersih)
                if (confirm('Hutang LUNAS! Hapus catatan ini?')) {
                    await deleteDoc(ref);
                } else {
                    await updateDoc(ref, { amount: 0, status: 'lunas' });
                }
            } else {
                // BAYAR SEBAGIAN -> Update sisa
                await updateDoc(ref, { amount: newAmount });
            }
            loadDebts(); // Refresh
        } catch (e) { alert("Gagal update: " + e.message); }
    };

    const filtered = debts.filter(d => 
        (d.customerName && d.customerName.toLowerCase().includes(search.toLowerCase()))
    );

    const totalHutang = filtered.reduce((sum, d) => sum + (d.amount || 0), 0);

    return (
        <div className="flex flex-col h-full bg-slate-50 p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2"><BookUser className="text-blue-600"/> Buku Kasbon</h1>
                    <p className="text-slate-500 text-sm">Catatan piutang pelanggan (Cloud).</p>
                </div>
                <div className="bg-red-100 text-red-700 px-4 py-2 rounded-xl font-bold border border-red-200 shadow-sm">
                    Total: {formatRupiah(totalHutang)}
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col flex-1 overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 text-slate-400" size={18}/>
                        <input value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 outline-none" placeholder="Cari nama pelanggan..." />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? <div className="p-10 text-center text-slate-400">Memuat data Cloud...</div> : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs sticky top-0">
                                <tr><th className="px-6 py-4">Tanggal</th><th className="px-6 py-4">Pelanggan</th><th className="px-6 py-4">Sisa Hutang</th><th className="px-6 py-4 text-center">Aksi</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.map(d => (
                                    <tr key={d.id} className="hover:bg-blue-50 transition-colors">
                                        <td className="px-6 py-4 text-slate-500 flex items-center gap-2">
                                            <Clock size={14}/> {new Date(d.date).toLocaleDateString('id-ID')}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-700">{d.customerName || 'Tanpa Nama'}</td>
                                        <td className="px-6 py-4 font-bold text-red-600">{formatRupiah(d.amount)}</td>
                                        <td className="px-6 py-4 text-center">
                                            <button onClick={() => handlePay(d)} className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-200 border border-green-200 flex items-center gap-1 mx-auto">
                                                <CheckCircle size={12}/> Bayar / Lunas
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    {!loading && filtered.length === 0 && <div className="p-8 text-center text-slate-400">Tidak ada data hutang.</div>}
                </div>
            </div>
        </div>
    );
};

export default KasbonView;