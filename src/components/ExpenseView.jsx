import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { formatRupiah } from '../utils';
import { Wallet, PlusCircle, Trash2, Calendar } from 'lucide-react';

const ExpenseView = () => {
    const [expenses, setExpenses] = useState([]);
    const [desc, setDesc] = useState('');
    const [amount, setAmount] = useState('');

    useEffect(() => {
        loadExpenses();
    }, []);

    const loadExpenses = async () => {
        const data = await db.expenses.orderBy('date').reverse().limit(50).toArray();
        setExpenses(data);
    };

    const addExpense = async (e) => {
        e.preventDefault();
        if (!desc || !amount) return alert('Isi semua field!');
        
        await db.expenses.add({ 
            date: new Date().toISOString(), 
            desc, 
            amount: parseInt(amount), 
            synced: 0 
        });
        
        setDesc('');
        setAmount('');
        loadExpenses();
    };

    const handleDelete = async (id) => {
        if (confirm('Hapus catatan pengeluaran ini?')) {
            await db.expenses.delete(id);
            loadExpenses();
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-100 p-6 overflow-hidden">
            <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Wallet className="text-red-600"/> Catatan Pengeluaran
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full overflow-hidden">
                
                {/* FORM INPUT (KIRI) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
                    <h3 className="font-bold text-lg mb-4 text-slate-700 flex items-center gap-2">
                        <PlusCircle size={20}/> Input Pengeluaran
                    </h3>
                    <form onSubmit={addExpense} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Keterangan</label>
                            <input 
                                value={desc} 
                                onChange={e => setDesc(e.target.value)} 
                                className="w-full border p-2 rounded outline-none focus:border-blue-500" 
                                placeholder="Contoh: Gaji Karyawan, Listrik..." 
                                required 
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Jumlah (Rp)</label>
                            <input 
                                type="number" 
                                value={amount} 
                                onChange={e => setAmount(e.target.value)} 
                                className="w-full border p-2 rounded outline-none focus:border-blue-500 font-bold text-slate-700" 
                                placeholder="0" 
                                required 
                            />
                        </div>
                        <button type="submit" className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 font-bold shadow-lg shadow-red-100 transition-all">
                            Simpan Pengeluaran
                        </button>
                    </form>
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg text-xs text-blue-700 leading-relaxed">
                        <span className="font-bold">Info:</span> Data ini akan mengurangi perhitungan profit di Dashboard agar Anda tahu keuntungan bersih sebenarnya.
                    </div>
                </div>

                {/* TABEL LIST (KANAN/TENGAH) */}
                <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="p-4 border-b bg-slate-50 font-bold text-slate-700">
                        Riwayat Terakhir
                    </div>
                    <div className="overflow-y-auto flex-1">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 text-slate-500 font-medium uppercase text-xs sticky top-0">
                                <tr>
                                    <th className="px-6 py-4">Waktu</th>
                                    <th className="px-6 py-4">Keterangan</th>
                                    <th className="px-6 py-4 text-right">Jumlah</th>
                                    <th className="px-6 py-4 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {expenses.map(ex => (
                                    <tr key={ex.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 text-slate-600">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={14} className="text-slate-400"/>
                                                {new Date(ex.date).toLocaleDateString('id-ID')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-800">{ex.desc}</td>
                                        <td className="px-6 py-4 text-right font-bold text-red-600">
                                            {formatRupiah(ex.amount)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button onClick={() => handleDelete(ex.id)} className="text-slate-400 hover:text-red-600 transition-colors" title="Hapus">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {expenses.length === 0 && (
                                    <tr><td colSpan="4" className="text-center py-10 text-slate-400">Belum ada pengeluaran dicatat.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExpenseView;