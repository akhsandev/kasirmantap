import React, { useState, useEffect } from 'react';
// MIGRASI FIREBASE
import { db, collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy } from '../firebase';
import { Users, Search, Plus, Trash2, Edit, Save, X, Star } from 'lucide-react';

const CustomersView = () => {
    const [customers, setCustomers] = useState([]);
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editingCust, setEditingCust] = useState(null);
    const [formData, setFormData] = useState({ name: '', phone: '', level: 'umum' });

    useEffect(() => { loadCustomers(); }, []);

    // LOAD DARI CLOUD
    const loadCustomers = async () => {
        try {
            const q = query(collection(db, 'customers'), orderBy('name'));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setCustomers(data);
        } catch (e) {
            console.error("Gagal load customer:", e);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (editingCust) {
                // UPDATE CLOUD
                const ref = doc(db, 'customers', editingCust.id);
                await updateDoc(ref, formData);
            } else {
                // ADD CLOUD
                await addDoc(collection(db, 'customers'), {
                    ...formData,
                    created_at: new Date().toISOString()
                });
            }
            setModalOpen(false); setEditingCust(null); setFormData({ name: '', phone: '', level: 'umum' });
            loadCustomers();
        } catch (e) { alert("Gagal simpan: " + e.message); }
    };

    const handleDelete = async (id) => {
        if (confirm('Hapus pelanggan ini dari Cloud?')) {
            try {
                await deleteDoc(doc(db, 'customers', id));
                loadCustomers();
            } catch (e) { alert("Gagal hapus: " + e.message); }
        }
    };

    const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="flex flex-col h-full bg-slate-50 p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2"><Users className="text-blue-600"/> Pelanggan</h1>
                    <p className="text-slate-500 text-sm">Manajemen data pelanggan & level member (Cloud).</p>
                </div>
                <button onClick={() => { setEditingCust(null); setFormData({ name: '', phone: '', level: 'umum' }); setModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all"><Plus size={18}/> Baru</button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col flex-1 overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 text-slate-400" size={18}/>
                        <input value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 outline-none" placeholder="Cari nama pelanggan..." />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs sticky top-0">
                            <tr><th className="px-6 py-4">Nama</th><th className="px-6 py-4">No. HP</th><th className="px-6 py-4">Level</th><th className="px-6 py-4 text-center">Aksi</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.map(c => (
                                <tr key={c.id} className="hover:bg-blue-50 transition-colors">
                                    <td className="px-6 py-4 font-bold text-slate-700">{c.name}</td>
                                    <td className="px-6 py-4 text-slate-500">{c.phone || '-'}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${c.level === 'vip' ? 'bg-purple-100 text-purple-700 border-purple-200' : c.level === 'grosir' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                            {c.level}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => { setEditingCust(c); setFormData(c); setModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"><Edit size={16}/></button>
                                            <button onClick={() => handleDelete(c.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg"><Trash2 size={16}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filtered.length === 0 && <div className="p-8 text-center text-slate-400">Data tidak ditemukan.</div>}
                </div>
            </div>

            {modalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl animate-scale-up">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg">{editingCust ? 'Edit Pelanggan' : 'Pelanggan Baru'}</h3>
                            <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-red-500"><X/></button>
                        </div>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">Nama Lengkap</label><input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border p-3 rounded-lg font-bold" placeholder="Nama Pelanggan"/></div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">Nomor HP / WA</label><input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full border p-3 rounded-lg" placeholder="08..."/></div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Level Member</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['umum', 'grosir', 'vip'].map(l => (
                                        <button type="button" key={l} onClick={() => setFormData({...formData, level: l})} className={`py-2 rounded-lg text-sm font-bold capitalize border ${formData.level === l ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>{l}</button>
                                    ))}
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2">
                                    * <b>Grosir/VIP:</b> Otomatis dapat harga murah walau beli satuan.
                                </p>
                            </div>
                            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg mt-2">Simpan Data Cloud</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomersView;