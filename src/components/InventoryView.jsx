import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { formatRupiah } from '../utils';
import { Plus, Save, Trash2, Edit2, Search, Package, ArrowRight, Layers } from 'lucide-react';

const InventoryView = () => {
    // State Data
    const [products, setProducts] = useState([]);
    
    // State Form Utama
	const [form, setForm] = useState({ 
        id: null, 
        name: '', 
        category: '', 
        image: '',
        
        base_unit: 'Pcs',
        price: '',         // Harga Ecer Dasar
        price_grosir: '',  // BARU: Harga Grosir Dasar
        cost_price: '', 
        stock: '',      
    });

    // State Multi-Satuan (Hierarchy) - Sesuai 
    // Default minimal ada 1 satuan (Base Unit itu sendiri)
    const [units, setUnits] = useState([
        { name: 'Pcs', conversion: 1, barcode: '', price_retail: '', price_grosir: '' }
    ]);
    
    // State Table & Pagination
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        const all = await db.products.toArray();
        setProducts(all.reverse());
    };

    // --- LOGIC TAMBAH SATUAN ---
    const addUnitRow = () => {
        setUnits([...units, { name: '', conversion: '', barcode: '', price_retail: '', price_grosir: '' }]);
    };

    const removeUnitRow = (index) => {
        if (units.length === 1) return alert("Minimal harus ada 1 satuan dasar!");
        const newUnits = [...units];
        newUnits.splice(index, 1);
        setUnits(newUnits);
    };

    const updateUnit = (index, field, value) => {
        const newUnits = [...units];
        newUnits[index][field] = value;
        
        // Auto-update base unit name di form utama jika baris pertama diedit
        if (index === 0 && field === 'name') {
            setForm(prev => ({ ...prev, base_unit: value }));
        }
        setUnits(newUnits);
    };

    // --- CRUD ACTIONS ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validasi Dasar
        if (!form.name) return alert('Nama barang wajib diisi!');
        if (!units[0].barcode) return alert('Barcode satuan dasar wajib diisi!');

        // Persiapan Data untuk Database
        // Sesuai konsep iPOS: Kita simpan struktur kompleks ini [cite: 3]
     
// ... (validasi di atas sama) ...
        const productData = {
            name: form.name,
            category: form.category || 'Umum',
            image: form.image || '',
            
            barcode: units[0].barcode,      
            price: parseInt(units[0].price_retail) || 0,
            
            // BARU: Simpan Harga Grosir Base Unit
            price_grosir: parseInt(units[0].price_grosir) || parseInt(units[0].price_retail), 

            cost_price: parseInt(form.cost_price) || 0,  
            stock: parseInt(form.stock) || 0,            
            
            base_unit: form.base_unit,
            multi_units: units.map(u => ({
                name: u.name,
                conversion: parseInt(u.conversion) || 1, 
                barcode: u.barcode,                      
                prices: {                                
                    retail: parseInt(u.price_retail) || 0,
                    grosir: parseInt(u.price_grosir) || 0
                }
            }))
        };
        // ... (sisa logic simpan ke db sama) ...
      
        try {
            if (form.id) {
                // Update
                // Cek konflik barcode jika berubah (kecuali punya sendiri)
                const current = await db.products.get(form.id);
                if (current.barcode !== productData.barcode) {
                    const exist = await db.products.where('barcode').equals(productData.barcode).first();
                    if (exist) return alert('Barcode dasar sudah dipakai barang lain!');
                }
                await db.products.update(form.id, productData);
            } else {
                // Create
                const exist = await db.products.where('barcode').equals(productData.barcode).first();
                if (exist) return alert('Barcode sudah ada!');
                await db.products.add(productData);
            }

            resetForm();
            loadProducts();
            alert('Data Master Item Tersimpan!');
        } catch (error) {
            console.error(error);
            alert('Gagal simpan data: ' + error.message);
        }
    };

    const handleDelete = async (id) => {
        if (confirm('Hapus barang ini?')) {
            await db.products.delete(id);
            loadProducts();
        }
    };

    const handleEdit = (p) => {
        // Load data flat ke form
        setForm({
            id: p.id,
            name: p.name,
            category: p.category,
            image: p.image,
            base_unit: p.base_unit || 'Pcs',
            cost_price: p.cost_price,
            stock: p.stock
        });

        // Load multi units jika ada, jika tidak buat default dari data flat
        if (p.multi_units && p.multi_units.length > 0) {
            const mappedUnits = p.multi_units.map(u => ({
                name: u.name,
                conversion: u.conversion,
                barcode: u.barcode,
                price_retail: u.prices?.retail || 0,
                price_grosir: u.prices?.grosir || 0
            }));
            setUnits(mappedUnits);
        } else {
            // Fallback untuk data lama
            setUnits([{
                name: 'Pcs',
                conversion: 1,
                barcode: p.barcode,
                price_retail: p.price,
                price_grosir: p.price // Default sama
            }]);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const resetForm = () => {
        setForm({ id: null, name: '', category: '', image: '', base_unit: 'Pcs', cost_price: '', stock: '' });
        setUnits([{ name: 'Pcs', conversion: 1, barcode: '', price_retail: '', price_grosir: '' }]);
    };

    // Pagination Logic
    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || String(p.barcode).includes(searchQuery));
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const paginatedData = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="flex flex-col h-full bg-slate-100 overflow-hidden">
            {/* HEADER */}
            <div className="bg-white p-4 shadow-sm border-b flex justify-between items-center shrink-0">
                <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Package className="text-blue-600" /> Master Item (iPOS Standard)
                </h1>
                <div className="text-sm text-slate-500">Total: {products.length} SKU</div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 lg:flex lg:gap-6">
                
                {/* FORM INPUT COMPELX (KIRI) */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 h-fit lg:w-[45%] mb-6 lg:mb-0 overflow-y-auto">
                    <h3 className="font-bold text-slate-700 mb-4 border-b pb-2 flex items-center gap-2">
                        {form.id ? <Edit2 size={16}/> : <Plus size={16}/>} 
                        {form.id ? 'Edit Item' : 'Input Barang Baru'}
                    </h3>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* 1. Identitas Barang */}
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">A. Identitas Dasar</h4>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Nama Barang</label>
                                    <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border p-2 rounded focus:border-blue-500 outline-none" placeholder="Contoh: Indomie Goreng" required />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">Kategori</label>
                                        <input list="catList" value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full border p-2 rounded outline-none" placeholder="Pilih..." />
                                        <datalist id="catList"><option value="Makanan"/><option value="Minuman"/><option value="Sembako"/></datalist>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">URL Foto</label>
                                        <input value={form.image} onChange={e => setForm({...form, image: e.target.value})} className="w-full border p-2 rounded outline-none" placeholder="https://..." />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Base Unit & HPP */}
                        <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                            <h4 className="text-xs font-bold text-green-700 uppercase mb-3 flex items-center gap-1">
                                <Layers size={12}/> B. Satuan Dasar & Harga
                            </h4>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Satuan Kecil</label>
                                    <input value={units[0].name} onChange={e => updateUnit(0, 'name', e.target.value)} className="w-full border p-2 rounded bg-white font-bold text-center" placeholder="Pcs" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Stok Fisik</label>
                                    <input type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} className="w-full border p-2 rounded bg-white outline-none font-bold" placeholder="0" />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="text-[10px] font-bold text-green-600 uppercase">Modal (HPP)</label>
                                    <input type="number" value={form.cost_price} onChange={e => setForm({...form, cost_price: e.target.value})} className="w-full border p-2 rounded bg-white outline-none text-xs" placeholder="0" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-blue-600 uppercase">Jual Ecer</label>
                                    <input type="number" value={units[0].price_retail} onChange={e => updateUnit(0, 'price_retail', e.target.value)} className="w-full border p-2 rounded bg-white outline-none font-bold text-blue-700 text-xs" placeholder="0" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-purple-600 uppercase">Jual Grosir</label>
                                    <input type="number" value={units[0].price_grosir} onChange={e => updateUnit(0, 'price_grosir', e.target.value)} className="w-full border p-2 rounded bg-white outline-none font-bold text-purple-700 text-xs" placeholder="0" />
                                </div>
                            </div>
                        </div>

                        {/* 3. Multi Satuan & Harga */}
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                            <h4 className="text-xs font-bold text-blue-700 uppercase mb-3 flex justify-between items-center">
                                <span>C. Multi Satuan & Harga Jual</span>
                                <button type="button" onClick={addUnitRow} className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded flex items-center gap-1 hover:bg-blue-700">
                                    <Plus size={10}/> Tambah Satuan
                                </button>
                            </h4>
                            
                            <div className="space-y-3">
                                {units.map((u, idx) => (
                                    <div key={idx} className="bg-white p-2 rounded border shadow-sm relative group">
                                        {/* Baris Atas: Satuan & Konversi */}
                                        <div className="flex gap-2 mb-2 items-center">
                                            <div className="w-8 flex justify-center items-center bg-slate-100 rounded text-xs font-bold text-slate-500 h-8">
                                                #{idx + 1}
                                            </div>
                                            <div className="flex-1">
                                                <input value={u.name} onChange={e => updateUnit(idx, 'name', e.target.value)} className="w-full text-xs border-b border-dashed outline-none focus:border-blue-500 py-1 font-bold" placeholder="Nama Satuan (Dus)" />
                                            </div>
                                            <div className="flex items-center gap-1 w-24">
                                                <span className="text-[10px] text-slate-400">=</span>
                                                <input type="number" disabled={idx === 0} value={u.conversion} onChange={e => updateUnit(idx, 'conversion', e.target.value)} className={`w-full text-xs border rounded px-1 py-1 text-center ${idx === 0 ? 'bg-slate-100 text-slate-400' : ''}`} placeholder="Jml" title="Isi Konversi (1 Dus = 12 Pcs)" />
                                                <span className="text-[10px] text-slate-400">{units[0].name}</span>
                                            </div>
                                            {idx > 0 && (
                                                <button type="button" onClick={() => removeUnitRow(idx)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button>
                                            )}
                                        </div>

                                        {/* Baris Bawah: Barcode & Harga */}
                                        <div className="grid grid-cols-3 gap-2">
                                            <div>
                                                <label className="text-[10px] text-slate-400 block">Barcode [cite: 8]</label>
                                                <div className="flex">
                                                    <input value={u.barcode} onChange={e => updateUnit(idx, 'barcode', e.target.value)} className="w-full text-xs border rounded px-1 py-1" placeholder="Scan..." />
                                                    <button type="button" onClick={() => updateUnit(idx, 'barcode', Date.now().toString() + idx)} className="bg-slate-100 px-1 border-l text-[10px]">Gen</button>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-slate-400 block">Harga Ecer (Umum)</label>
                                                <input type="number" value={u.price_retail} onChange={e => updateUnit(idx, 'price_retail', e.target.value)} className="w-full text-xs border rounded px-1 py-1 font-medium text-blue-700" placeholder="Rp" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-slate-400 block">Harga Grosir/Toko</label>
                                                <input type="number" value={u.price_grosir} onChange={e => updateUnit(idx, 'price_grosir', e.target.value)} className="w-full text-xs border rounded px-1 py-1 font-medium text-purple-700" placeholder="Rp" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                            {form.id && <button type="button" onClick={resetForm} className="flex-1 bg-slate-200 text-slate-700 py-3 rounded-lg font-medium">Batal</button>}
                            <button type="submit" className="flex-[2] bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-bold flex justify-center items-center gap-2 shadow-lg">
                                <Save size={18} /> Simpan Master Data
                            </button>
                        </div>
                    </form>
                </div>

                {/* TABEL DATA (KANAN) */}
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[80vh] lg:h-auto">
                    <div className="p-3 border-b bg-slate-50 flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                            <input className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm outline-none" placeholder="Cari nama atau barcode..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} />
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 text-slate-500 font-bold uppercase text-xs sticky top-0">
                                <tr>
                                    <th className="px-4 py-3">Produk</th>
                                    <th className="px-4 py-3 text-right">Harga Dasar</th>
                                    <th className="px-4 py-3 text-center">Stok</th>
                                    <th className="px-4 py-3 text-center">Satuan</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {paginatedData.map(p => (
                                    <tr key={p.id} className="hover:bg-blue-50 transition-colors cursor-pointer" onClick={() => handleEdit(p)}>
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-slate-700">{p.name}</div>
                                            <div className="text-xs text-slate-400 font-mono">{p.barcode}</div>
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium">
                                            {formatRupiah(p.price)}
                                            <div className="text-[10px] text-green-600">Modal: {formatRupiah(p.cost_price)}</div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${p.stock < 5 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                                {p.stock} {p.base_unit || 'Pcs'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {p.multi_units ? (
                                                <div className="flex flex-wrap gap-1 justify-center">
                                                    {p.multi_units.map((u, i) => (
                                                        <span key={i} className="text-[10px] bg-slate-100 border px-1 rounded text-slate-600" title={`1 ${u.name} = ${u.conversion} ${p.base_unit}`}>
                                                            {u.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : <span className="text-[10px] text-slate-400">Single</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination sama seperti sebelumnya... */}
                </div>
            </div>
        </div>
    );
};

export default InventoryView;