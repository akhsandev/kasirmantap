import React, { useState, useEffect, useRef } from 'react';
import { db, collection, getDocs, getDocsFromCache, query, orderBy } from '../firebase';
import { formatRupiah } from '../utils';
import { 
    Search, Plus, Minus, Trash2, ShoppingCart, 
    CreditCard, RefreshCw, Package, Tag, Users, User 
} from 'lucide-react';

// MENERIMA PROP BARU: lastSuccessItems
const PosView = ({ cart, setCart, onProcessPayment, syncPushSmart, loadingSync, activeUser, selectedCustomer, setSelectedCustomer, lastSuccessItems }) => {
    const [products, setProducts] = useState([]);
    const [customersList, setCustomersList] = useState([]);
    const [search, setSearch] = useState('');
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('Semua');
    const barcodeInputRef = useRef(null);

    useEffect(() => { loadData(); }, []);

    // --- LOGIKA UPDATE STOK INSTAN (TANPA RELOAD) ---
    useEffect(() => {
        if (lastSuccessItems && lastSuccessItems.length > 0) {
            // Kita update state 'products' secara lokal
            const updatedProducts = products.map(p => {
                // Cari apakah produk ini ada di daftar barang terjual
                // Kita harus cek ID produk asli
                const soldItem = lastSuccessItems.find(item => 
                    item.id === p.id || (item.original_product && item.original_product.id === p.id)
                );

                if (soldItem) {
                    // Hitung pengurangan: Qty * Konversi (misal 1 Dus = 12 Pcs)
                    const qtyDeduct = soldItem.qty * (soldItem.conversion || 1);
                    return { ...p, stock: p.stock - qtyDeduct };
                }
                return p;
            });

            setProducts(updatedProducts);
        }
    }, [lastSuccessItems]); // <--- AKAN JALAN OTOMATIS SAAT TRANSAKSI SUKSES

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'F1') {
                e.preventDefault(); 
                if (barcodeInputRef.current) {
                    barcodeInputRef.current.focus(); 
                    barcodeInputRef.current.select(); 
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const loadData = async () => {
        try {
            const prodRef = collection(db, 'products');
            const custRef = collection(db, 'customers');
            const smartFetch = async (q) => {
                try {
                    if (!navigator.onLine) throw new Error("Offline");
                    const serverPromise = getDocs(q);
                    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 1500));
                    return await Promise.race([serverPromise, timeoutPromise]);
                } catch (e) {
                    return await getDocsFromCache(q);
                }
            };
            const [prodSnap, custSnap] = await Promise.all([smartFetch(prodRef), smartFetch(custRef)]);
            const allProds = prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const allCusts = custSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProducts(allProds);
            setCustomersList(allCusts);
            const cats = ['Semua', ...new Set(allProds.map(p => p.category).filter(c => c))].sort();
            setCategories(cats);
        } catch (error) { console.error("Gagal load data:", error); }
    };

    useEffect(() => {
        const newCart = cart.map(item => {
            const priceInfo = calculatePrice(item.wholesaleConfig, item.qty);
            return { ...item, price: priceInfo.price, isWholesale: priceInfo.isWholesale };
        });
        setCart(newCart);
    }, [selectedCustomer]); 

    const calculatePrice = (config, qty) => {
        const qtyTrigger = config.min_grosir > 0 && qty >= config.min_grosir;
        const customerTrigger = selectedCustomer && (selectedCustomer.level === 'grosir' || selectedCustomer.level === 'vip');
        const hasWholesalePrice = config.price_grosir > 0;
        if (hasWholesalePrice && (qtyTrigger || customerTrigger)) return { price: config.price_grosir, isWholesale: true };
        return { price: config.price, isWholesale: false };
    };

    const addToCart = (productData, unitData = null) => {
        const isMulti = !!unitData;
        const itemId = isMulti ? `${productData.id}-${unitData.barcode}` : productData.id;
        const name = isMulti ? `${productData.name} (${unitData.name})` : productData.name;
        const basePrice = isMulti ? parseInt(unitData.price) : parseInt(productData.price);
        const conversion = isMulti ? parseInt(unitData.conversion) : 1;
        const wholesaleConfig = { price_grosir: isMulti ? 0 : productData.price_grosir, min_grosir: isMulti ? 9999 : productData.min_grosir, price: basePrice };

        const existItem = cart.find(i => i.id === itemId);
        let newCart = [];
        if (existItem) {
            const newQty = existItem.qty + 1;
            const maxStock = Math.floor(productData.stock / conversion);
            if (newQty > maxStock) return alert('Stok tidak cukup!');
            const priceInfo = calculatePrice(wholesaleConfig, newQty);
            newCart = cart.map(i => i.id === itemId ? { ...i, qty: newQty, price: priceInfo.price, isWholesale: priceInfo.isWholesale } : i);
        } else {
            if (productData.stock < conversion) return alert('Stok Habis!');
            const priceInfo = calculatePrice(wholesaleConfig, 1);
            newCart = [...cart, { id: itemId, barcode: isMulti ? unitData.barcode : productData.barcode, name: name, price: priceInfo.price, original_price: basePrice, qty: 1, conversion: conversion, original_product: productData, isWholesale: priceInfo.isWholesale, wholesaleConfig: wholesaleConfig }];
        }
        setCart(newCart);
    };

    const updateQty = (itemId, val) => {
        if (val < 1) { if (confirm('Hapus item ini?')) removeFromCart(itemId); return; }
        const item = cart.find(i => i.id === itemId);
        if (!item) return;
        const maxStock = Math.floor(item.original_product.stock / item.conversion);
        if (val > maxStock) return alert('Stok Mentok!');
        const priceInfo = calculatePrice(item.wholesaleConfig, val);
        setCart(cart.map(i => i.id === itemId ? { ...i, qty: val, price: priceInfo.price, isWholesale: priceInfo.isWholesale } : i));
    };

    const removeFromCart = (itemId) => setCart(cart.filter(i => i.id !== itemId));

    const handleScan = async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const code = search.trim();
            if (!code) return;
            let found = null;
            const mainProd = products.find(p => p.barcode === code);
            if (mainProd) { found = { product: mainProd, level: 'base', unit: null }; } 
            else {
                for (let p of products) {
                    if (p.multi_units && p.multi_units.length > 0) {
                        const unit = p.multi_units.find(u => u.barcode === code);
                        if (unit) { found = { product: p, level: 'unit', unit: unit }; break; }
                    }
                }
            }
            if (found) {
                if (found.level === 'base') addToCart(found.product);
                else addToCart(found.product, found.unit);
                setSearch('');
            } else { alert('Barang tidak ditemukan!'); }
        }
    };

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const filteredProducts = products.filter(p => {
        const matchCat = selectedCategory === 'Semua' || p.category === selectedCategory;
        const matchName = p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search);
        return matchCat && matchName;
    });

    return (
        <div className="flex flex-col md:flex-row h-full bg-slate-100 overflow-hidden">
            <div className="flex-1 flex flex-col min-w-0">
                <div className="p-4 bg-white shadow-sm z-10">
                    <div className="flex gap-2 mb-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 text-slate-400" size={20}/>
                            <input ref={barcodeInputRef} value={search} onChange={e => setSearch(e.target.value)} onKeyDown={handleScan} className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none font-bold text-slate-700 transition-all placeholder:font-normal" placeholder="Tekan F1 untuk Scan Barcode..." autoFocus />
                            <div className="absolute right-3 top-3 text-[10px] bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded text-slate-500 font-bold hidden md:block">F1</div>
                        </div>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                        {categories.map(c => ( <button key={c} onClick={() => setSelectedCategory(c)} className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${selectedCategory === c ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{c}</button> ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {filteredProducts.map(p => (
                            <div key={p.id} onClick={() => addToCart(p)} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:border-blue-500 hover:shadow-md transition-all group relative overflow-hidden">
                                <div className="font-bold text-slate-700 text-lg leading-tight mb-1 group-hover:text-blue-600 transition-colors">{p.name}</div>
                                <div className="text-xs text-slate-400 font-mono mb-2">{p.barcode}</div>
                                <div className="flex justify-between items-end">
                                    <div className="font-black text-blue-600">{formatRupiah(p.price)}</div>
                                    <div className={`text-xs font-bold px-2 py-1 rounded ${p.stock <= 5 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>Stok: {p.stock}</div>
                                </div>
                                {p.price_grosir > 0 && <div className="mt-2 pt-2 border-t border-dashed text-[10px] text-green-600 font-medium flex items-center gap-1"><Tag size={10}/> Grosir: {formatRupiah(p.price_grosir)} (Min {p.min_grosir})</div>}
                                {p.multi_units?.length > 0 && <div className="absolute top-0 right-0 p-1"><div className="bg-indigo-500 text-white text-[10px] px-1.5 rounded-bl-lg">Multi</div></div>}
                            </div>
                        ))}
                    </div>
                    {filteredProducts.length === 0 && <div className="flex flex-col items-center justify-center h-64 text-slate-400 opacity-60"><Package size={64} className="mb-4"/><p>Barang tidak ditemukan</p></div>}
                </div>
            </div>

            <div className="w-full md:w-96 bg-white border-l border-slate-200 flex flex-col shadow-2xl z-20 h-40vh md:h-full">
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-slate-700 font-bold"><ShoppingCart className="text-blue-600"/> Keranjang</div>
                    <div className="flex items-center gap-2">
                        <div className="text-xs text-right hidden md:block">
                            <div className="text-slate-400">Kasir</div>
                            <div className="font-bold text-slate-800">{activeUser?.username || 'Owner'}</div>
                        </div>
                        <button onClick={() => syncPushSmart()} disabled={loadingSync} className={`p-2 rounded-full ${loadingSync ? 'bg-slate-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}`}><RefreshCw size={18} className={loadingSync ? 'animate-spin' : ''}/></button>
                    </div>
                </div>
                <div className="px-4 py-3 bg-white border-b border-slate-100">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Users size={12}/> Pelanggan (CRM)</label>
                    <div className="relative">
                        <select className="w-full p-2 pl-9 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-blue-500 appearance-none" value={selectedCustomer ? selectedCustomer.id : ''} onChange={(e) => { const custId = e.target.value; const cust = customersList.find(c => c.id === custId); setSelectedCustomer(cust || null); }}>
                            <option value="">Umum (Harga Normal)</option>
                            {customersList.map(c => ( <option key={c.id} value={c.id}>{c.name} {c.level !== 'umum' ? `(${c.level.toUpperCase()})` : ''}</option> ))}
                        </select>
                        <User size={16} className="absolute left-2.5 top-2.5 text-slate-400"/>
                    </div>
                    {selectedCustomer && selectedCustomer.level === 'grosir' && <div className="mt-1 text-[10px] text-green-600 font-bold bg-green-50 px-2 py-1 rounded border border-green-100 text-center">Mode Grosir Aktif!</div>}
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-50/50">
                    {cart.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-slate-300"><ShoppingBagSize size={64} /><p className="mt-2 text-sm font-medium">Keranjang Kosong</p></div> : cart.map(item => (
                        <div key={item.id} className={`bg-white p-3 rounded-xl border shadow-sm flex flex-col gap-2 transition-all ${item.isWholesale ? 'border-green-300 ring-1 ring-green-100' : 'border-slate-100'}`}>
                            <div className="flex justify-between items-start"><div className="flex-1"><div className="font-bold text-slate-700 line-clamp-2">{item.name}</div><div className="flex items-center gap-2 mt-1"><div className="text-xs font-mono text-slate-500">{formatRupiah(item.price)}</div>{item.isWholesale && <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse"><Tag size={10}/> GROSIR</span>}</div></div><div className="font-bold text-slate-800">{formatRupiah(item.price * item.qty)}</div></div>
                            <div className="flex justify-between items-center bg-slate-50 rounded-lg p-1"><div className="flex items-center gap-1"><button onClick={() => updateQty(item.id, item.qty - 1)} className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded hover:bg-red-50 hover:text-red-500"><Minus size={14}/></button><input type="number" value={item.qty} onChange={(e) => updateQty(item.id, parseInt(e.target.value) || 0)} className="w-12 text-center bg-transparent font-bold text-slate-700 outline-none text-sm"/><button onClick={() => updateQty(item.id, item.qty + 1)} className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded hover:bg-blue-50 hover:text-blue-500"><Plus size={14}/></button></div><button onClick={() => removeFromCart(item.id)} className="text-slate-400 hover:text-red-500 p-2"><Trash2 size={16}/></button></div>
                        </div>
                    ))}
                </div>
                <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-20">
                    <div className="flex justify-between items-end mb-4"><div className="text-slate-500 text-sm">Total Tagihan</div><div className="text-3xl font-black text-slate-800 tracking-tight">{formatRupiah(subtotal)}</div></div>
                    <button onClick={() => onProcessPayment(subtotal)} disabled={cart.length === 0} className={`w-full py-4 rounded-xl font-black text-lg shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${cart.length === 0 ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-300'}`}><CreditCard size={24}/> BAYAR (F2)</button>
                </div>
            </div>
        </div>
    );
};
const ShoppingBagSize = ({size}) => (<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>);
export default PosView;