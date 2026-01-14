import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { formatRupiah, printReceipt } from '../utils';
import { Search, Printer, Trash2, FileText, ChevronDown, ChevronUp } from 'lucide-react';

const TransactionsView = () => {
    const [transactions, setTransactions] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedRow, setExpandedRow] = useState(null); // Untuk accordion detail

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        // Ambil 100 transaksi terakhir agar ringan
        const data = await db.transactions.orderBy('date').reverse().limit(100).toArray();
        setTransactions(data);
    };

    const handleDelete = async (id) => {
        if (confirm('Hapus riwayat transaksi ini? Stok barang TIDAK akan kembali otomatis (harus manual).')) {
            await db.transactions.delete(id);
            loadData();
        }
    };

    const filteredData = transactions.filter(tx => 
        tx.id.toString().includes(searchQuery) || 
        (tx.customerName && tx.customerName.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="flex flex-col h-full bg-slate-100 p-6 overflow-hidden">
            <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <FileText className="text-blue-600"/> Riwayat Transaksi
            </h1>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                <div className="p-4 border-b bg-slate-50">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                        <input 
                            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm outline-none focus:border-blue-500" 
                            placeholder="Cari ID Transaksi atau Nama..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 text-slate-500 font-bold uppercase text-xs sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3">Waktu</th>
                                <th className="px-6 py-3">Pelanggan/Ket</th>
                                <th className="px-6 py-3 text-right">Total</th>
                                <th className="px-6 py-3 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredData.map(tx => (
                                <React.Fragment key={tx.id}>
                                    <tr 
                                        onClick={() => setExpandedRow(expandedRow === tx.id ? null : tx.id)}
                                        className="hover:bg-blue-50 cursor-pointer transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-700">
                                                {new Date(tx.date).toLocaleDateString('id-ID')}
                                            </div>
                                            <div className="text-xs text-slate-400">
                                                {new Date(tx.date).toLocaleTimeString('id-ID')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-700">{tx.customerName || 'Umum'}</div>
                                            <div className="text-xs text-slate-500">
                                                {tx.payment === 0 && tx.type === 'debt' 
                                                    ? <span className="text-red-600 font-bold">HUTANG</span> 
                                                    : <span className="text-green-600 font-bold">LUNAS</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-slate-800">
                                            {formatRupiah(tx.finalTotal)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={(e) => { e.stopPropagation(); printReceipt(tx); }} className="p-2 text-slate-500 hover:bg-slate-200 rounded-full" title="Cetak Ulang">
                                                    <Printer size={16} />
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); handleDelete(tx.id); }} className="p-2 text-red-400 hover:bg-red-100 rounded-full" title="Hapus">
                                                    <Trash2 size={16} />
                                                </button>
                                                {expandedRow === tx.id ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
                                            </div>
                                        </td>
                                    </tr>
                                    {/* DETAIL ROW (ACCORDION) */}
                                    {expandedRow === tx.id && (
                                        <tr className="bg-slate-50">
                                            <td colSpan="4" className="p-4 border-b border-blue-100">
                                                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm max-w-2xl mx-auto">
                                                    <h4 className="font-bold text-xs uppercase text-slate-500 mb-2">Detail Barang</h4>
                                                        <ul className="space-y-2 text-sm">
                                                            {tx.items.map((item, idx) => (
                                                                <li key={idx} className="flex justify-between border-b border-dashed pb-1 last:border-0">
                                                                    {/* TAMPILKAN NAMA + SATUAN (Misal: Indomie [Dus]) */}
                                                                    <div className="flex flex-col">
                                                                        <span className="font-medium text-slate-700">
                                                                            {item.name} <span className="font-bold text-blue-600">({item.unit || 'Pcs'})</span>
                                                                        </span>
                                                                        <span className="text-[10px] text-slate-400">@{formatRupiah(item.price)}</span>
                                                                    </div>
                                                                    
                                                                    <div className="text-right">
                                                                        <span className="font-bold">x{item.qty}</span>
                                                                        <div className="font-medium">{formatRupiah(item.price * item.qty)}</div>
                                                                    </div>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    <div className="mt-3 pt-2 border-t flex justify-between font-bold text-slate-700">
                                                        <span>Profit Transaksi Ini:</span>
                                                        <span className="text-green-600">{formatRupiah(tx.profit)}</span>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TransactionsView;