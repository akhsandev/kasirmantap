import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, ShoppingCart, Minus, Plus, Banknote, ScanBarcode, Cloud, ChevronDown, User, Users } from 'lucide-react';
import { db, findProductByAnyBarcode } from '../db';
import { formatRupiah } from '../utils';

const PosView = ({ onProcessPayment, cart, setCart, syncPushSmart, loadingSync }) => {
    // State Data Dasar
    const [products, setProducts] = useState([]);
    const [customers, setCustomers] = useState([]); // BARU: Daftar Pelanggan
    
    // State Kasir
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Semua');
    const [visibleCount, setVisibleCount] = useState(24);
    
    // State CRM (Pelanggan Aktif)
    const [activeCustomer, setActiveCustomer] = useState(null); // null artinya Pelanggan Umum
    
    const barcodeInputRef = useRef(null);

    useEffect(() => {
        loadData();
        if(barcodeInputRef.current) barcodeInputRef.current.focus();

        const handleKeyDown = (e) => {
            if (e.key === 'F1') {
                e.preventDefault();
                if(barcodeInputRef.current) {
                    barcodeInputRef.current.focus();
                    barcodeInputRef.current.select();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const loadData = async () => {
        const [allProducts, allCustomers] = await Promise.all([
            db.products.toArray(),
            db.customers.toArray()
        ]);
        setProducts(allProducts);
        setCustomers(allCustomers);
    };

    // --- LOGIC HARGA DINAMIS (INTI CRM) ---
    // Fungsi sakti untuk menentukan harga berdasarkan Level Pelanggan & Satuan
    const getPriceForLevel = (product, unitName, customerLevel) => {
        // 1. Cek apakah ini Base Unit?
        if (unitName === (product.base_unit || 'Pcs')) {
            if (customerLevel === 'grosir') {
                // Ambil harga grosir base unit, kalau tidak ada, fallback ke retail
                return product.price_grosir || product.price;
            }
            return product.price; // Retail
        }

        // 2. Cek apakah ini Multi Unit?
        const unitData = product.multi_units?.find(u => u.name === unitName);
        if (unitData) {
            if (customerLevel === 'grosir') {
                return unitData.prices?.grosir || unitData.prices?.retail || 0;
            }
            return unitData.prices?.retail || 0;
        }

        return 0; // Error fallback
    };

    // Fungsi saat user mengganti pelanggan di Dropdown
    const handleCustomerChange = (customerId) => {
        let newCustomer = null;
        let newLevel = 'retail'; // Default

        if (customerId !== 'umum') {
            const c = customers.find(cust => cust.id === parseInt(customerId));
            if (c) {
                newCustomer = c;
                newLevel = c.level || 'retail';
            }
        }

        setActiveCustomer(newCustomer);

        // RECALCULATE CART: Update harga semua barang di keranjang sesuai level baru
        setCart(prevCart => prevCart.map(item => {
            const newPrice = getPriceForLevel(item.original_product, item.unit, newLevel);
            return {
                ...item,
                price: newPrice
            };
        }));
    };

    // --- LOGIKA KERANJANG ---
    const addToCart = (productData, specificUnit = null) => {
        const currentLevel = activeCustomer?.level || 'retail';
        
        // Tentukan Unit
        const unitName = specificUnit?.name || productData.base_unit || 'Pcs';
        const unitConversion = specificUnit?.conversion || 1;
        const unitBarcode = specificUnit?.barcode || productData.barcode;

        // Tentukan Harga (Pakai Logic Dinamis)
        const finalPrice = getPriceForLevel(productData, unitName, currentLevel);

        // Cek Stok Fisik
        if (productData.stock < unitConversion) {
            return alert(`Stok tidak cukup! Sisa fisik: ${productData.stock} ${productData.base_unit || 'Pcs'}`);
        }

        setCart(prev => {
            const existingIdx = prev.findIndex(item => item.id === productData.id && item.unit === unitName);
            
            if (existingIdx >= 0) {
                const newCart = [...prev];
                const item = newCart[existingIdx];
                const newTotalReq = (item.qty + 1) * item.conversion;
                
                if (newTotalReq > productData.stock) {
                    alert("Stok mentok!");
                    return prev;
                }
                newCart[existingIdx] = { ...item, qty: item.qty + 1 };
                return newCart;
            } else {
                return [...prev, {
                    id: productData.id,
                    name: productData.name,
                    unit: unitName,
                    conversion: unitConversion,
                    price: finalPrice, // Harga sudah otomatis menyesuaikan level
                    original_product: productData,
                    barcode: unitBarcode,
                    qty: 1
                }];
            }
        });
    };

    const changeItemUnit = (index, newUnitName) => {
        setCart(prev => {
            const newCart = [...prev];
            const item = newCart[index];
            const product = item.original_product;
            const currentLevel = activeCustomer?.level || 'retail';

            let newConversion = 1;
            
            // Cari konversi unit baru
            if (newUnitName !== (product.base_unit || 'Pcs')) {
                const u = product.multi_units?.find(unit => unit.name === newUnitName);
                if (u) newConversion = u.conversion;
            }

            // Hitung harga baru berdasarkan unit & level pelanggan
            const newPrice = getPriceForLevel(product, newUnitName, currentLevel);

            newCart[index] = {
                ...item,
                unit: newUnitName,
                conversion: newConversion,
                price: newPrice
            };
            return newCart;
        });
    };

    const updateQty = (index, delta) => {
        setCart(prev => {
            const newCart = [...prev];
            const item = newCart[index];
            const product = item.original_product;
            const newQty = item.qty + delta;
            
            if (newQty <= 0) return prev.filter((_, i) => i !== index);

            const totalReq = newQty * item.conversion;
            if (delta > 0 && totalReq > product.stock) return prev; 
            
            newCart[index] = { ...item, qty: newQty };
            return newCart;
        });
    };

    const handleBarcode = async (e) => {
        if (e.key === 'Enter') {
            const code = e.target.value.trim();
            if (!code) return;

            const result = await findProductByAnyBarcode(code);

            if (result) {
                // addToCart sudah pintar, cukup kirim data produk & unitnya
                addToCart(result.product, {
                    name: result.unit.name,
                    conversion: result.unit.conversion,
                    barcode: result.unit.barcode
                    // Harga tidak perlu dikirim manual, biar addToCart yang hitung based on Customer Level
                });
                setSearchQuery('');
            } else {
                const partial = products.filter(p => p.name.toLowerCase().includes(code.toLowerCase()));
                if (partial.length === 1) {
                    addToCart(partial[0]);
                    setSearchQuery('');
                } else {
                    alert('Barang tidak ditemukan!');
                }
            }
        }
    };

    // Helpers untuk UI Grid
    const categories = useMemo(() => {
        const cats = new Set(products.map(p => p.category || 'Umum'));
        return ['Semua', ...Array.from(cats)];
    }, [products]);

    const filteredAndSlicedProducts = useMemo(() => {
        let res = products;
        if (selectedCategory !== 'Semua') res = res.filter(p => (p.category || 'Umum') === selectedCategory);
        if (searchQuery) {
            const lower = searchQuery.toLowerCase();
            res = res.filter(p => {
                const matchName = p.name.toLowerCase().includes(lower);
                const matchBase = String(p.barcode).includes(lower);
                const matchMulti = p.multi_units && p.multi_units.some(u => String(u.barcode).includes(lower));
                return matchName || matchBase || matchMulti;
            });
        }
        return { data: res.slice(0, visibleCount), hasMore: res.length > visibleCount, total: res.length };
    }, [products, searchQuery, selectedCategory, visibleCount]);

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    return (
        <div className="flex h-full flex-col md:flex-row bg-slate-100 overflow-hidden">
            {/* KIRI: PRODUK */}
            <div className="flex-1 flex flex-col p-4 overflow-hidden relative">
                <div className="bg-white p-3 rounded-xl shadow-sm mb-4 flex gap-2 items-center border border-slate-200">
                    <ScanBarcode className="text-slate-400" />
                    <input 
                        ref={barcodeInputRef}
                        type="text" 
                        className="flex-1 text-lg outline-none font-medium text-slate-700 placeholder:text-slate-300" 
                        placeholder="Scan Barcode (F1)..." 
                        value={searchQuery} 
                        onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(24); }} 
                        onKeyDown={handleBarcode} 
                    />
                    {searchQuery && <button onClick={() => setSearchQuery('')}><X className="text-slate-400" /></button>}
                </div>

                <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide shrink-0">
                    {categories.map(cat => (
                        <button key={cat} onClick={() => { setSelectedCategory(cat); setVisibleCount(24); }} 
                            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${selectedCategory === cat ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 border hover:bg-blue-50'}`}>
                            {cat}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto pb-20">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {filteredAndSlicedProducts.data.map(product => (
                            <div key={product.id} onClick={() => addToCart(product)} 
                                className={`bg-white p-4 rounded-xl shadow-sm border border-slate-200 cursor-pointer active:scale-95 flex flex-col justify-between h-[140px] hover:border-blue-400 transition-all ${product.stock <= 0 ? 'opacity-60 grayscale' : ''}`}>
                                <div className="flex items-start gap-2">
                                    <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400 overflow-hidden shrink-0">
                                        {product.image ? <img src={product.image} className="w-full h-full object-cover"/> : product.name.charAt(0)}
                                    </div>
                                    <div className="overflow-hidden">
                                        <h3 className="font-semibold text-slate-800 leading-tight text-sm line-clamp-2">{product.name}</h3>
                                        {product.multi_units?.length > 0 && <span className="text-[9px] bg-purple-100 text-purple-700 px-1 rounded border border-purple-200 mt-1 inline-block">Multi Satuan</span>}
                                    </div>
                                </div>
                                <div className="flex justify-between items-end mt-2">
                                    <span className="font-bold text-blue-600 text-sm">{formatRupiah(product.price)}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${product.stock <= 0 ? 'bg-red-200 text-red-800' : 'bg-green-100 text-green-700'}`}>
                                        {product.stock} {product.base_unit || 'Pcs'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                    {filteredAndSlicedProducts.hasMore && (
                        <button onClick={() => setVisibleCount(c => c + 24)} className="w-full py-3 mt-4 bg-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-300">Muat Lebih Banyak</button>
                    )}
                </div>
            </div>

            {/* KANAN: KERANJANG & PELANGGAN */}
            <div className="w-full md:w-[350px] bg-white border-l border-slate-200 flex flex-col shadow-xl z-10 h-[40vh] md:h-auto">
                {/* 1. Header Keranjang */}
                <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                    <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2"><ShoppingCart size={20}/> Keranjang</h2>
                    <button onClick={syncPushSmart} disabled={loadingSync} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-bold hover:bg-green-200 flex items-center gap-1">
                        {loadingSync ? '...' : <><Cloud size={12}/> Sync</>}
                    </button>
                </div>

                {/* 2. Selector Pelanggan (CRM) */}
                <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
                    <label className="text-[10px] font-bold text-blue-600 uppercase mb-1 flex items-center gap-1">
                        <User size={10}/> Pelanggan Aktif
                    </label>
                    <div className="relative">
                        <select 
                            className="w-full text-sm font-bold text-slate-700 bg-white border border-blue-200 rounded p-2 outline-none focus:border-blue-500 cursor-pointer appearance-none"
                            value={activeCustomer?.id || 'umum'}
                            onChange={(e) => handleCustomerChange(e.target.value)}
                        >
                            <option value="umum">Pelanggan Umum (Eceran)</option>
                            {customers.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.name} {c.level === 'grosir' ? '⭐(Grosir)' : ''}
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none"/>
                    </div>
                    {activeCustomer?.level === 'grosir' && (
                        <div className="mt-1 text-[10px] text-green-600 font-bold flex items-center gap-1 animate-pulse">
                            <Users size={10}/> Mode Harga Grosir Aktif!
                        </div>
                    )}
                </div>
                
                {/* 3. List Item */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {cart.length === 0 && <div className="text-center text-slate-400 mt-10 text-sm">Keranjang Kosong</div>}
                    {cart.map((item, idx) => (
                        <div key={`${item.id}-${item.unit}`} className={`p-2 rounded-lg border flex flex-col gap-2 group transition-colors ${activeCustomer?.level === 'grosir' ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                            <div className="flex justify-between items-start">
                                <div className="font-medium text-sm line-clamp-1">{item.name}</div>
                                <div className="text-blue-600 font-bold text-xs">{formatRupiah(item.price * item.qty)}</div>
                            </div>
                            <div className="flex justify-between items-center bg-white p-1 rounded border">
                                <div className="relative group/unit">
                                    <select 
                                        className="appearance-none bg-transparent text-xs font-bold pl-2 pr-6 py-1 rounded cursor-pointer outline-none"
                                        value={item.unit}
                                        onChange={(e) => changeItemUnit(idx, e.target.value)}
                                    >
                                        <option value={item.original_product.base_unit || 'Pcs'}>{item.original_product.base_unit || 'Pcs'}</option>
                                        {item.original_product.multi_units?.map(u => (
                                            <option key={u.name} value={u.name}>{u.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={12} className="absolute right-1 top-2 text-slate-500 pointer-events-none"/>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => updateQty(idx, -1)} className="hover:text-red-500 p-1"><Minus size={14}/></button>
                                    <span className="font-bold w-6 text-center text-sm">{item.qty}</span>
                                    <button onClick={() => updateQty(idx, 1)} className="hover:text-blue-500 p-1"><Plus size={14}/></button>
                                </div>
                            </div>
                            <div className="flex justify-between items-center px-1">
                                <div className="text-[10px] text-slate-400">@{formatRupiah(item.price)}/{item.unit}</div>
                                {activeCustomer?.level === 'grosir' && <span className="text-[9px] bg-green-200 text-green-800 px-1 rounded font-bold">Grosir</span>}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 bg-white border-t shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
                    <div className="flex justify-between mb-4 text-xl">
                        <span className="text-slate-500 font-medium text-sm">Total</span>
                        <span className="font-black text-slate-800">{formatRupiah(subtotal)}</span>
                    </div>
                    <button 
                        onClick={() => cart.length > 0 && onProcessPayment(subtotal)} 
                        disabled={cart.length === 0} 
                        className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-lg flex justify-center items-center gap-2 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-lg shadow-blue-200"
                    >
                        <Banknote /> BAYAR (F2)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PosView;