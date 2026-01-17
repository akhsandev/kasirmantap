import React, { useState, useEffect } from 'react';
// MIGRASI FIREBASE
import { db, collection, addDoc, deleteDoc, doc, getDocs, query, orderBy } from '../firebase';
import { Wallet, Plus, Trash2, Calendar } from 'lucide-react';
import { formatRupiah } from '../utils';

const ExpenseView = () => {
    const [expenses, setExpenses] = useState([]);
    const [desc, setDesc] = useState('');
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => { loadExpenses(); }, []);

    const loadExpenses = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'expenses'), orderBy('date', 'desc'));
            const snapshot = await getDocs(q);
            setExpenses(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!amount || !desc) return;
        try {
            await addDoc(collection(db, 'expenses'), {
                date: new Date().toISOString(),
                desc,
                amount: parseInt(amount)
            });
            setDesc(''); setAmount(''); loadExpenses();
        } catch (e) { alert("Error: " + e.message); }
    };

    const handleDelete = async (id) => {
        if (confirm('Hapus catatan ini?')) {
            await deleteDoc(doc(db, 'expenses', id));
            loadExpenses();
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 p-6 overflow-hidden">
            <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 mb-6"><Wallet className="text-blue-600"/> Pengeluaran Toko</h1>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full overflow-hidden">
                {/* FORM INPUT */}
                <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
                    <h3 className="font-bold text-lg mb-4">Catat Pengeluaran</h3>
                    <form onSubmit={handleAdd} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Keterangan</label>
                            <input value={desc} onChange={e => setDesc(e.target.value)} className="w-full border p-3 rounded-lg" placeholder="Contoh: Bayar Listrik" required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Jumlah (Rp)</label>
                            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full border p-3 rounded-lg" placeholder="0" required />
                        </div>
                        <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg flex items-center justify-center gap-2"><Plus size={18}/> Simpan ke Cloud</button>
                    </form>
                </div>

                {/* TABEL LIST */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs sticky top-0">
                                <tr><th className="px-6 py-4">Tanggal</th><th className="px-6 py-4">Keterangan</th><th className="px-6 py-4">Jumlah</th><th className="px-6 py-4 text-center">Aksi</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {expenses.map(ex => (
                                    <tr key={ex.id} className="hover:bg-blue-50">
                                        <td className="px-6 py-4 text-slate-500 flex items-center gap-2"><Calendar size={14}/> {new Date(ex.date).toLocaleDateString('id-ID')}</td>
                                        <td className="px-6 py-4 font-bold text-slate-700">{ex.desc}</td>
                                        <td className="px-6 py-4 font-bold text-red-600">{formatRupiah(ex.amount)}</td>
                                        <td className="px-6 py-4 text-center">
                                            <button onClick={() => handleDelete(ex.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={16}/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {expenses.length === 0 && <div className="p-8 text-center text-slate-400">Belum ada data.</div>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExpenseView;