import React, { useState, useEffect, useRef } from 'react';
// IMPORT DARI FIREBASE
import { db, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from '../firebase'; 
// IMPORT BARU: printLabel58mm
import { generateBarcode, printLabel58mm } from '../utils';
import { 
    Package, Plus, Search, Trash2, Edit, Save, X, 
    ChevronDown, Check, Download, AlertTriangle, Printer 
} from 'lucide-react';

const CategoryDropdown = ({ value, onChange, existingCategories }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isCustom, setIsCustom] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (value && !existingCategories.includes(value) && value !== '') setIsCustom(true);
    }, [value, existingCategories]);

    const handleSelect = (cat) => {
        if (cat === 'OTHER_NEW') { setIsCustom(true); onChange(''); } 
        else { setIsCustom(false); onChange(cat); }
        setIsOpen(false);
    };

    if (isCustom) {
        return (
            <div className="relative animate-fade-in">
                <input autoFocus type="text" value={value} onChange={(e) => onChange(e.target.value)} className="w-full border-2 border-blue-400 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-200 transition-all" placeholder="Ketik Kategori Baru..." />
                <button onClick={() => setIsCustom(false)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-red-500 hover:underline font-bold" type="button">Batal</button>
            </div>
        );
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button type="button" onClick={() => setIsOpen(!isOpen)} className={`w-full flex justify-between items-center border p-2 rounded-lg bg-white transition-all duration-200 ${isOpen ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-300 hover:border-slate-400'}`}>
                <span className={value ? "text-slate-800 font-medium" : "text-slate-400"}>{value || "Pilih Kategori..."}</span>
                <ChevronDown size={18} className={`text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}/>
            </button>
            <div className={`absolute z-50 mt-2 w-full bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden transition-all duration-300 origin-top ${isOpen ? 'opacity-100 scale-y-100 max-h-60' : 'opacity-0 scale-y-95 max-h-0 pointer-events-none'}`}>
                <div className="overflow-y-auto max-h-60 py-1">
                    {existingCategories.length === 0 && <div className="p-3 text-xs text-slate-400 text-center italic">Belum ada kategori.</div>}
                    {existingCategories.map((cat, idx) => (
                        <button key={idx} type="button" onClick={() => handleSelect(cat)} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center justify-between transition-colors group">
                            <span className="font-medium">{cat}</span>
                            {value === cat && <Check size={14} className="text-blue-600"/>}
                        </button>
                    ))}
                    <div className="border-t my-1"></div>
                    <button type="button" onClick={() => handleSelect('OTHER_NEW')} className="w-full text-left px-4 py-3 text-sm text-blue-600 font-bold hover:bg-blue-50 flex items-center gap-2"><Plus size={14}/> Tambah Kategori Baru / Lainnya...</button>
                </div>
            </div>
        </div>
    );
};

const InventoryView = () => {
    const [products, setProducts] = useState([]);
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [uniqueCategories, setUniqueCategories] = useState([]);
    const [barcodeImg, setBarcodeImg] = useState(null);

    const [formData, setFormData] = useState({
        barcode: '', name: '', category: '', price: '', stock: '', cost_price: '', 
        price_grosir: '', min_grosir: '', multi_units: [] 
    });

    useEffect(() => { loadProducts(); }, []);

    useEffect(() => {
        if (formData.barcode) {
            const img = generateBarcode(formData.barcode);
            setBarcodeImg(img);
        } else {
            setBarcodeImg(null);
        }
    }, [formData.barcode]);

    const loadProducts = async () => {
        try {
            const q = query(collection(db, "products"), orderBy("name")); 
            const querySnapshot = await getDocs(q);
            const allProducts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            setProducts(allProducts.reverse()); 
            const cats = [...new Set(allProducts.map(p => p.category).filter(c => c))].sort();
            setUniqueCategories(cats);
        } catch (error) {
            console.error("Error loading products:", error);
            alert("Gagal memuat data dari Cloud. Cek internet!");
        }
    };

    const resetForm = () => setFormData({ barcode: '', name: '', category: '', price: '', stock: '', cost_price: '', price_grosir: '', min_grosir: '', multi_units: [] });
    
    const handleEdit = (product) => {
        setEditingProduct(product);
        setFormData(product);
        setModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (confirm('Hapus produk ini dari Cloud?')) {
            try {
                await deleteDoc(doc(db, "products", id));
                loadProducts();
            } catch (e) { alert("Gagal hapus: " + e.message); }
        }
    };

    const checkDuplicateBarcode = (code, excludeId = null) => {
        if (!code) return false;
        const normalizedCode = code.trim();
        for (let p of products) {
            if (excludeId && p.id === excludeId) continue; 
            if (p.barcode === normalizedCode) return `Barcode '${normalizedCode}' sudah dipakai produk: ${p.name}`;
            if (p.multi_units && p.multi_units.length > 0) {
                const foundUnit = p.multi_units.find(u => u.barcode === normalizedCode);
                if (foundUnit) return `Barcode '${normalizedCode}' sudah dipakai satuan ${foundUnit.name} di produk: ${p.name}`;
            }
        }
        return false;
    };

    const handleSave = async (e) => {
        e.preventDefault();
        
        const mainError = checkDuplicateBarcode(formData.barcode, editingProduct?.id);
        if (mainError) return alert(mainError);

        if (formData.multi_units && formData.multi_units.length > 0) {
            for (let unit of formData.multi_units) {
                if (unit.barcode) {
                    const unitError = checkDuplicateBarcode(unit.barcode, editingProduct?.id);
                    if (unitError) return alert(unitError);
                    if (unit.barcode === formData.barcode) return alert(`Barcode satuan ${unit.name} tidak boleh sama dengan barcode utama!`);
                }
            }
        }

        const payload = {
            ...formData,
            barcode: formData.barcode || Date.now().toString(), 
            price: parseInt(formData.price) || 0,
            stock: parseInt(formData.stock) || 0,
            cost_price: parseInt(formData.cost_price) || 0,
            price_grosir: parseInt(formData.price_grosir) || 0,
            min_grosir: parseInt(formData.min_grosir) || 0,
            multi_units: formData.multi_units || []
        };

        try {
            if (editingProduct) {
                const productRef = doc(db, "products", editingProduct.id);
                await updateDoc(productRef, payload);
            } else {
                await addDoc(collection(db, "products"), payload);
            }
            setModalOpen(false); resetForm(); setEditingProduct(null); loadProducts();
        } catch (e) {
            alert("Gagal simpan ke Cloud: " + e.message);
        }
    };

    const addMultiUnit = () => setFormData({...formData, multi_units: [...formData.multi_units, { name: '', conversion: '', price: '', barcode: '', price_grosir: '' }]});
    const updateMultiUnit = (idx, field, val) => {
        const newUnits = [...formData.multi_units];
        newUnits[idx][field] = val;
        setFormData({...formData, multi_units: newUnits});
    };
    const removeMultiUnit = (idx) => {
        const newUnits = formData.multi_units.filter((_, i) => i !== idx);
        setFormData({...formData, multi_units: newUnits});
    };

    const handleDownloadBarcode = () => {
        if (barcodeImg) {
            const link = document.createElement('a');
            link.href = barcodeImg;
            link.download = `Barcode-${formData.name || 'Produk'}.png`;
            link.click();
        }
    };

    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search));

    return (
        <div className="flex flex-col h-full bg-slate-50 p-6 overflow-hidden">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 shrink-0">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2"><Package className="text-blue-600"/> Stok Barang (Cloud)</h1>
                    <p className="text-slate-500 text-sm">Data tersimpan aman di Firebase Firestore.</p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-3 text-slate-400" size={18}/>
                        <input value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all" placeholder="Cari nama / barcode..." />
                    </div>
                    <button onClick={() => { resetForm(); setModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-200 flex items-center gap-2 transition-all active:scale-95"><Plus size={20}/> <span className="hidden md:inline">Produk Baru</span></button>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="overflow-y-auto flex-1">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs sticky top-0 z-10">
                            <tr><th className="px-6 py-4">Produk</th><th className="px-6 py-4">Kategori</th><th className="px-6 py-4">Harga Jual</th><th className="px-6 py-4">Stok</th><th className="px-6 py-4 text-center">Aksi</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredProducts.map(p => (
                                <tr key={p.id} className="hover:bg-blue-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800">{p.name}</div>
                                        <div className="text-xs text-slate-400 font-mono">{p.barcode}</div>
                                        {p.multi_units?.length > 0 && (<div className="mt-1 flex gap-1 flex-wrap">{p.multi_units.map((u, i) => (<span key={i} className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100">{u.name} (1:{u.conversion})</span>))}</div>)}
                                    </td>
                                    <td className="px-6 py-4">{p.category ? (<span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">{p.category}</span>) : <span className="text-slate-300 italic">-</span>}</td>
                                    <td className="px-6 py-4"><div className="font-bold text-slate-700">Rp {parseInt(p.price).toLocaleString('id-ID')}</div>{p.price_grosir > 0 && (<div className="text-[10px] text-green-600 font-medium">Grosir: Rp {parseInt(p.price_grosir).toLocaleString()} (Min {p.min_grosir})</div>)}</td>
                                    <td className="px-6 py-4"><div className={`font-bold ${p.stock <= 5 ? 'text-red-600' : 'text-slate-700'}`}>{p.stock}</div></td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEdit(p)} className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"><Edit size={16}/></button>
                                            <button onClick={() => handleDelete(p.id)} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"><Trash2 size={16}/></button>
                                        </div>
                                    </td>
                                </tr> 
                            ))}
                        </tbody>
                    </table>
                    {filteredProducts.length === 0 && <div className="p-10 text-center text-slate-400 flex flex-col items-center"><Package size={48} className="mb-2 opacity-20"/><p>Tidak ada produk ditemukan di Cloud.</p></div>}
                </div>
            </div>

            {modalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scale-up">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">{editingProduct ? <><Edit size={20} className="text-blue-600"/> Edit Produk</> : <><Plus size={20} className="text-blue-600"/> Tambah Produk Baru</>}</h2>
                            <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={24}/></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                            <form id="productForm" onSubmit={handleSave} className="space-y-6">
                                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                                    <h3 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wide border-b pb-2">Informasi Produk</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Nama Produk <span className="text-red-500">*</span></label>
                                            <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-blue-500 font-bold text-lg text-slate-800" placeholder="Contoh: Indomie Goreng" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Barcode / Kode</label>
                                            <div className="flex gap-2">
                                                <input value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} className="w-full border p-2 rounded-lg font-mono text-slate-600" placeholder="Scan / Ketik..." />
                                                <button type="button" onClick={() => setFormData({...formData, barcode: Date.now().toString()})} className="px-3 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200">Auto</button>
                                            </div>
                                            {/* --- PREVIEW & TOMBOL CETAK LABEL (ULTIMATE 58MM) --- */}
                                            {barcodeImg && (
                                                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col items-center">
                                                    <img src={barcodeImg} alt="Barcode Preview" className="h-10 object-contain mix-blend-multiply" />
                                                    <div className="flex gap-2 mt-2 w-full">
                                                        <button type="button" onClick={handleDownloadBarcode} className="flex-1 py-1.5 text-[10px] bg-white border border-slate-300 rounded hover:bg-slate-100 font-bold text-slate-600 flex justify-center items-center gap-1"><Download size={12}/> Download PNG</button>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => printLabel58mm(formData.name || 'Produk', formData.price, barcodeImg, formData.barcode)} 
                                                            className="flex-1 py-1.5 text-[10px] bg-slate-800 text-white rounded hover:bg-black font-bold flex justify-center items-center gap-1 shadow-md"
                                                        >
                                                            <Printer size={12}/> Cetak Label (58mm)
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Kategori</label>
                                            <CategoryDropdown value={formData.category} onChange={(val) => setFormData({...formData, category: val})} existingCategories={uniqueCategories} />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                                    <h3 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wide border-b pb-2">Harga & Stok (Satuan Dasar)</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="col-span-2 md:col-span-1"><label className="block text-xs font-bold text-slate-500 mb-1">Modal (HPP)</label><input type="number" required value={formData.cost_price} onChange={e => setFormData({...formData, cost_price: e.target.value})} className="w-full border p-2 rounded-lg" placeholder="0" /></div>
                                        <div className="col-span-2 md:col-span-1"><label className="block text-xs font-bold text-blue-600 mb-1">Harga Jual (Umum)</label><input type="number" required value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full border-2 border-blue-100 p-2 rounded-lg font-bold text-slate-800 focus:border-blue-500" placeholder="0" /></div>
                                        <div className="col-span-2 md:col-span-1"><label className="block text-xs font-bold text-slate-500 mb-1">Stok Awal</label><input type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} className="w-full border p-2 rounded-lg bg-yellow-50" placeholder="0" /></div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-dashed grid grid-cols-2 gap-4 bg-green-50/50 p-3 rounded-lg">
                                        <div><label className="block text-xs font-bold text-green-700 mb-1">Harga Grosir (Member)</label><input type="number" value={formData.price_grosir} onChange={e => setFormData({...formData, price_grosir: e.target.value})} className="w-full border p-2 rounded-lg border-green-200" placeholder="Opsional" /></div>
                                        <div><label className="block text-xs font-bold text-green-700 mb-1">Min. Beli (Qty)</label><input type="number" value={formData.min_grosir} onChange={e => setFormData({...formData, min_grosir: e.target.value})} className="w-full border p-2 rounded-lg border-green-200" placeholder="Contoh: 10" /></div>
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                                    <div className="flex justify-between items-center mb-4 border-b pb-2"><h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Multi Satuan (Opsional)</h3><button type="button" onClick={addMultiUnit} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 border border-indigo-200 flex items-center gap-1"><Plus size={12}/> Tambah Satuan</button></div>
                                    {formData.multi_units.length === 0 && <p className="text-xs text-slate-400 italic">Tidak ada satuan tambahan (Hanya jual PCS).</p>}
                                    <div className="space-y-3">
                                        {formData.multi_units.map((unit, idx) => (
                                            <div key={idx} className="flex flex-col md:flex-row gap-2 items-start md:items-center bg-slate-50 p-3 rounded-lg border border-slate-200 relative group">
                                                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2 w-full">
                                                    <input placeholder="Nama (Cth: Dus)" value={unit.name} onChange={e => updateMultiUnit(idx, 'name', e.target.value)} className="border p-2 rounded text-xs" />
                                                    <input type="number" placeholder="Isi (Cth: 12)" value={unit.conversion} onChange={e => updateMultiUnit(idx, 'conversion', e.target.value)} className="border p-2 rounded text-xs" />
                                                    <input type="number" placeholder="Harga Jual Unit Ini" value={unit.price} onChange={e => updateMultiUnit(idx, 'price', e.target.value)} className="border p-2 rounded text-xs font-bold text-blue-600" />
                                                    <input placeholder="Barcode Khusus (Opsional)" value={unit.barcode} onChange={e => updateMultiUnit(idx, 'barcode', e.target.value)} className="border p-2 rounded text-xs font-mono" />
                                                </div>
                                                <button type="button" onClick={() => removeMultiUnit(idx)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={16}/></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div className="p-4 bg-white border-t border-slate-200 flex justify-end gap-3 shrink-0">
                            <button onClick={() => setModalOpen(false)} className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100">Batal</button>
                            <button form="productForm" type="submit" className="px-6 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 flex items-center gap-2"><Save size={18}/> Simpan (Cloud)</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InventoryView;