import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { formatRupiah } from '../utils';
import { Users, Search, Save, Edit2, Trash2, UserPlus, Star } from 'lucide-react';

const CustomersView = () => {
    const [customers, setCustomers] = useState([]);
    const [search, setSearch] = useState('');
    const [form, setForm] = useState({ id: null, name: '', phone: '', level: 'retail' });
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        const all = await db.customers.toArray();
        setCustomers(all.reverse());
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name) return alert("Nama wajib diisi");

        try {
            const data = {
                name: form.name,
                phone: form.phone,
                level: form.level // 'retail' atau 'grosir'
            };

            if (form.id) {
                await db.customers.update(form.id, data);
            } else {
                await db.customers.add(data);
            }
            
            setForm({ id: null, name: '', phone: '', level: 'retail' });
            setIsEditing(false);
            loadData();
            alert("Pelanggan tersimpan!");
        } catch (err) {
            console.error(err);
        }
    };

    const handleEdit = (c) => {
        setForm(c);
        setIsEditing(true);
    };

    const handleDelete = async (id) => {
        if(confirm("Hapus pelanggan? Data hutang (jika ada) mungkin akan orphan.")) {
            await db.customers.delete(id);
            loadData();
        }
    };

    const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="flex flex-col md:flex-row h-full bg-slate-100 p-6 gap-6 overflow-hidden">
            {/* FORM INPUT (KIRI) */}
            <div className="w-full md:w-1/3 bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
                <h3 className="font-bold text-lg mb-4 text-slate-700 flex items-center gap-2">
                    {isEditing ? <Edit2 size={20}/> : <UserPlus size={20}/>}
                    {isEditing ? 'Edit Pelanggan' : 'Pelanggan Baru'}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Nama Lengkap</label>
                        <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border p-2 rounded outline-none focus:border-blue-500" required placeholder="Contoh: Toko Berkah" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">No. HP / WA</label>
                        <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full border p-2 rounded outline-none focus:border-blue-500" placeholder="08..." />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Level Harga</label>
                        <select value={form.level || 'retail'} onChange={e => setForm({...form, level: e.target.value})} className="w-full border p-2 rounded outline-none focus:border-blue-500 bg-white">
                            <option value="retail">Umum (Harga Ecer)</option>
                            <option value="grosir">Reseller / Grosir (Harga Murah)</option>
                        </select>
                        <p className="text-[10px] text-slate-400 mt-1">*Pelanggan Grosir otomatis mendapat harga spesial di kasir.</p>
                    </div>
                    <div className="flex gap-2 pt-2">
                        {isEditing && <button type="button" onClick={() => { setIsEditing(false); setForm({ id: null, name: '', phone: '', level: 'retail' }); }} className="flex-1 bg-slate-200 py-2 rounded font-bold text-slate-600">Batal</button>}
                        <button type="submit" className="flex-[2] bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700">Simpan</button>
                    </div>
                </form>
            </div>

            {/* LIST DATA (KANAN) */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2"><Users size={18}/> Data Pelanggan</h3>
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 w-4 h-4 text-slate-400"/>
                        <input value={search} onChange={e => setSearch(e.target.value)} className="pl-8 pr-4 py-2 border rounded-lg text-sm outline-none" placeholder="Cari nama..." />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                    {filtered.map(c => (
                        <div key={c.id} className="flex justify-between items-center p-3 hover:bg-slate-50 border-b border-dashed last:border-0">
                            <div>
                                <div className="font-bold text-slate-800 flex items-center gap-2">
                                    {c.name}
                                    {c.level === 'grosir' && <span className="bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1"><Star size={10} fill="currentColor"/> GROSIR</span>}
                                </div>
                                <div className="text-xs text-slate-400">{c.phone || '-'}</div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleEdit(c)} className="p-2 text-blue-500 hover:bg-blue-50 rounded"><Edit2 size={16}/></button>
                                <button onClick={() => handleDelete(c.id)} className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                    {filtered.length === 0 && <div className="text-center p-10 text-slate-400">Belum ada data pelanggan.</div>}
                </div>
            </div>
        </div>
    );
};

export default CustomersView;