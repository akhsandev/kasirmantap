import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { formatRupiah } from '../utils';
import { BookUser, Wallet, History, User } from 'lucide-react';

const KasbonView = () => {
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerHistory, setCustomerHistory] = useState([]);
    const [payAmount, setPayAmount] = useState('');

    useEffect(() => {
        loadCustomers();
    }, []);

    const loadCustomers = async () => {
        const allCust = await db.customers.toArray();
        const allDebts = await db.debts.toArray();

        // Hitung saldo setiap customer
        const withBalance = allCust.map(c => {
            const myDebts = allDebts.filter(d => d.customerId === c.id);
            const balance = myDebts.reduce((acc, d) => 
                d.type === 'borrow' ? acc + d.amount : acc - d.amount
            , 0);
            return { ...c, balance };
        }).filter(c => c.balance > 0); // Hanya tampilkan yang punya hutang

        setCustomers(withBalance.sort((a,b) => b.balance - a.balance));
    };

    const selectCustomer = async (c) => {
        setSelectedCustomer(c);
        const history = await db.debts.where('customerId').equals(c.id).reverse().sortBy('date');
        setCustomerHistory(history);
        setPayAmount('');
    };

    const handlePay = async (e) => {
        e.preventDefault();
        const amount = parseInt(payAmount);
        if (!amount || amount <= 0) return alert('Masukkan jumlah pembayaran yang valid');

        await db.debts.add({
            customerId: selectedCustomer.id,
            date: new Date().toISOString(),
            amount: amount,
            type: 'pay',
            synced: 0
        });

        alert('Pembayaran dicatat!');
        loadCustomers();
        // Update tampilan detail secara manual
        const history = await db.debts.where('customerId').equals(selectedCustomer.id).reverse().sortBy('date');
        setCustomerHistory(history);
        setPayAmount('');
        
        // Update saldo customer terpilih di UI
        const newBalance = selectedCustomer.balance - amount;
        setSelectedCustomer({...selectedCustomer, balance: newBalance});
    };

    return (
        <div className="flex h-full bg-slate-100 p-4 md:p-6 gap-6 overflow-hidden">
            
            {/* LIST DAFTAR PENGUTANG (KIRI) */}
            <div className={`flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col ${selectedCustomer ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b bg-slate-50 font-bold text-slate-700 flex items-center gap-2">
                    <BookUser className="text-orange-500"/> Buku Kasbon
                </div>
                <div className="flex-1 overflow-y-auto">
                    {customers.length === 0 && <div className="p-6 text-center text-slate-400">Tidak ada data hutang aktif.</div>}
                    {customers.map(c => (
                        <div 
                            key={c.id} 
                            onClick={() => selectCustomer(c)}
                            className={`p-4 border-b hover:bg-orange-50 cursor-pointer flex justify-between items-center transition-all ${selectedCustomer?.id === c.id ? 'bg-orange-50 border-l-4 border-l-orange-500' : ''}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                                    <User size={20}/>
                                </div>
                                <div className="font-bold text-slate-700">{c.name}</div>
                            </div>
                            <div className="text-orange-600 font-mono font-bold">{formatRupiah(c.balance)}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* DETAIL & FORM BAYAR (KANAN) */}
            {selectedCustomer ? (
                <div className="flex-[2] flex flex-col h-full overflow-hidden">
                    {/* Header Card */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6 shrink-0">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">{selectedCustomer.name}</h2>
                                <p className="text-slate-500 text-sm">Total Sisa Hutang</p>
                            </div>
                            <button onClick={() => setSelectedCustomer(null)} className="md:hidden text-slate-400">Tutup</button>
                            <div className="text-4xl font-black text-orange-600">{formatRupiah(selectedCustomer.balance)}</div>
                        </div>
                        
                        {/* Form Bayar */}
                        {selectedCustomer.balance > 0 ? (
                            <form onSubmit={handlePay} className="flex gap-2">
                                <div className="flex-1 relative">
                                    <span className="absolute left-3 top-3 text-slate-400 font-bold">Rp</span>
                                    <input 
                                        type="number" 
                                        value={payAmount} 
                                        onChange={e => setPayAmount(e.target.value)} 
                                        className="w-full border p-2 pl-10 rounded-lg outline-none focus:border-green-500 font-bold text-lg" 
                                        placeholder="Jumlah bayar..." 
                                        required 
                                        autoFocus
                                    />
                                </div>
                                <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 flex items-center gap-2 shadow-lg shadow-green-200">
                                    <Wallet size={18}/> Bayar
                                </button>
                            </form>
                        ) : (
                            <div className="bg-green-100 text-green-700 p-3 rounded-lg font-bold text-center">
                                LUNAS! Tidak ada tanggungan.
                            </div>
                        )}
                    </div>

                    {/* Riwayat Mutasi */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col">
                        <div className="p-4 border-b bg-slate-50 font-bold text-slate-700 flex items-center gap-2">
                            <History size={18}/> Riwayat Mutasi
                        </div>
                        <div className="overflow-y-auto flex-1 p-4 space-y-2">
                            {customerHistory.map(h => (
                                <div key={h.id} className="flex justify-between items-center border-b border-dashed pb-3 last:border-0">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-full ${h.type === 'borrow' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                            {h.type === 'borrow' ? <Wallet size={16}/> : <Wallet size={16}/>}
                                        </div>
                                        <div>
                                            <div className={`font-bold text-sm ${h.type === 'borrow' ? 'text-red-600' : 'text-green-600'}`}>
                                                {h.type === 'borrow' ? 'Tambah Hutang (Kasbon)' : 'Pembayaran Cicilan'}
                                            </div>
                                            <div className="text-xs text-slate-400">{new Date(h.date).toLocaleString('id-ID')}</div>
                                        </div>
                                    </div>
                                    <div className={`font-mono font-bold ${h.type === 'borrow' ? 'text-red-600' : 'text-green-600'}`}>
                                        {h.type === 'borrow' ? '+' : '-'}{formatRupiah(h.amount)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                // Placeholder Kanan jika belum pilih customer
                <div className="flex-[2] hidden md:flex items-center justify-center bg-slate-200/50 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 font-bold">
                    Pilih pelanggan di sebelah kiri
                </div>
            )}
        </div>
    );
};

export default KasbonView;