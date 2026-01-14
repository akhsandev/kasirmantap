import React, { useState, useEffect, useRef } from 'react';
import { db } from '../db';
import { exportDatabase, importDatabase, exportToExcel } from '../utils';
import { Save, Server, Image, Trash2, AlertTriangle, Download, Upload, FileSpreadsheet, RefreshCw, CreditCard, QrCode, UserPlus, Users, Key } from 'lucide-react';

const SettingsView = () => {
    // Config Store
    const [config, setConfig] = useState({ apiUrl: '', imgbbKey: '', storeName: 'RUKO POS', storeAddress: '', bankAccount: '', qrisImage: '' });
    
    // Config User
    const [users, setUsers] = useState([]);
    const [newUser, setNewUser] = useState({ username: '', pin: '', role: 'cashier' });

    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(false);
    const [uploadingQris, setUploadingQris] = useState(false);
    const fileInputRef = useRef(null); 
    const qrisInputRef = useRef(null); 

    useEffect(() => { 
        loadSettings(); 
        loadUsers(); // Load Users
    }, []);

    const loadSettings = async () => {
        const keys = ['apiUrl', 'imgbbKey', 'storeName', 'storeAddress', 'bankAccount', 'qrisImage'];
        const newConfig = { ...config };
        for (const key of keys) {
            const item = await db.settings.get(key);
            if (item) newConfig[key] = item.value;
        }
        setConfig(newConfig);
    };

    const loadUsers = async () => {
        const allUsers = await db.users.toArray();
        setUsers(allUsers);
    };

    // --- MANAJEMEN USER ---
    const handleAddUser = async (e) => {
        e.preventDefault();
        if (!newUser.username || !newUser.pin) return alert('Nama dan PIN wajib diisi!');
        if (newUser.pin.length < 4) return alert('PIN minimal 4 angka!');

        await db.users.add({
            username: newUser.username,
            pin: newUser.pin,
            role: newUser.role
        });
        
        setNewUser({ username: '', pin: '', role: 'cashier' });
        loadUsers();
        alert('Pengguna berhasil ditambahkan!');
    };

    const handleDeleteUser = async (id, role) => {
        if (role === 'admin') return alert('Admin utama tidak boleh dihapus sembarangan!'); // Proteksi sederhana
        if (confirm('Hapus pengguna ini?')) {
            await db.users.delete(id);
            loadUsers();
        }
    };

    // --- FUNGSI LAIN (SAMA SEPERTI SEBELUMNYA) ---
    const handleSave = async (e) => {
        e.preventDefault();
        try {
            for (const [key, value] of Object.entries(config)) await db.settings.put({ key, value });
            setSaved(true); setTimeout(() => setSaved(false), 2000);
        } catch (error) { alert('Gagal menyimpan: ' + error.message); }
    };

    const handleQrisUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!config.imgbbKey) return alert('Harap isi API Key ImgBB dulu di bawah!');
        setUploadingQris(true);
        try {
            const formData = new FormData();
            formData.append("image", file);
            const res = await fetch(`https://api.imgbb.com/1/upload?key=${config.imgbbKey}`, { method: "POST", body: formData });
            const data = await res.json();
            if (data.success) {
                const url = data.data.url;
                setConfig(prev => ({ ...prev, qrisImage: url }));
                await db.settings.put({ key: 'qrisImage', value: url });
                alert("QRIS Berhasil Diupload!");
            } else { throw new Error('Gagal Upload ke ImgBB'); }
        } catch (err) { alert('Error Upload: ' + err.message); } finally { setUploadingQris(false); }
    };

    const handlePullData = async () => {
        if (!config.apiUrl) return alert('URL App Script belum diisi!');
        if (!confirm('PERINGATAN: Semua data PRODUK akan ditimpa. Lanjutkan?')) return;
        setLoading(true);
        try {
            const response = await fetch(`${config.apiUrl}?action=get_products`);
            const result = await response.json();
            if (result.status === 'success') {
                await db.products.clear(); 
                const productsFromServer = result.products.map(p => ({
                    ...p, price: parseInt(p.price) || 0, stock: parseInt(p.stock) || 0, cost_price: parseInt(p.cost_price) || 0
                }));
                await db.products.bulkAdd(productsFromServer);
                alert(`Sukses! ${productsFromServer.length} Produk berhasil ditarik.`);
            } else { throw new Error(result.message); }
        } catch (error) { alert('Gagal Tarik Data: ' + error.message); } finally { setLoading(false); }
    };

    const handleBackup = async () => { const success = await exportDatabase(db); if(success) alert('Backup Downloaded!'); };
    const handleRestoreClick = () => fileInputRef.current.click();
    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if(!confirm('Restore akan MENIMPA semua data. Yakin?')) { e.target.value = ''; return; }
        try { setLoading(true); await importDatabase(db, file); alert('Restore Berhasil! Refreshing...'); window.location.reload(); } 
        catch (error) { alert('Gagal Restore: ' + error.message); } finally { setLoading(false); e.target.value = ''; }
    };
    const handleExcelExport = async () => { setLoading(true); await exportToExcel(db); setLoading(false); alert('Excel Downloaded!'); };
    const handleFactoryReset = async () => { if (confirm('BAHAYA: Reset Database?')) { await db.delete(); window.location.reload(); } };

    return (
        <div className="flex flex-col h-full bg-slate-100 p-6 overflow-y-auto">
            <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Server className="text-slate-500"/> Pusat Kontrol & Pengaturan
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl">
                
                {/* 1. MANAJEMEN PENGGUNA (BARU) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-2">
                    <h3 className="font-bold text-lg mb-4 text-blue-800 border-b pb-2 flex items-center gap-2">
                        <Users size={20}/> Manajemen Pengguna (Admin & Kasir)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Form Tambah */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <h4 className="font-bold text-sm text-slate-700 mb-3 flex items-center gap-2"><UserPlus size={16}/> Tambah Pengguna Baru</h4>
                            <form onSubmit={handleAddUser} className="space-y-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Nama Pengguna</label>
                                    <input value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} className="w-full border p-2 rounded text-sm" placeholder="Contoh: Kasir Pagi" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">PIN Akses (Angka)</label>
                                    <input type="number" value={newUser.pin} onChange={e => setNewUser({...newUser, pin: e.target.value})} className="w-full border p-2 rounded text-sm font-mono tracking-widest" placeholder="123456" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Peran (Role)</label>
                                    <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className="w-full border p-2 rounded text-sm">
                                        <option value="cashier">Kasir (Terbatas)</option>
                                        <option value="admin">Admin (Full Akses)</option>
                                    </select>
                                </div>
                                <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded font-bold text-sm hover:bg-blue-700">Simpan Pengguna</button>
                            </form>
                        </div>

                        {/* List User */}
                        <div>
                            <h4 className="font-bold text-sm text-slate-700 mb-3 flex items-center gap-2"><Key size={16}/> Daftar Akses</h4>
                            <div className="space-y-2">
                                {users.map(u => (
                                    <div key={u.id} className="flex justify-between items-center p-3 bg-white border rounded-lg shadow-sm">
                                        <div>
                                            <div className="font-bold text-slate-800 flex items-center gap-2">
                                                {u.username} 
                                                <span className={`text-[10px] px-2 py-0.5 rounded uppercase ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>{u.role}</span>
                                            </div>
                                            <div className="text-xs text-slate-400 font-mono">PIN: {u.pin}</div>
                                        </div>
                                        {u.username !== 'Owner' && (
                                            <button onClick={() => handleDeleteUser(u.id, u.role)} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 size={16}/></button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. CONFIG TOKO */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-lg mb-4 text-slate-700 border-b pb-2">Identitas Toko & API</h3>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-500 mb-1">Nama Toko</label>
                            <input value={config.storeName} onChange={e => setConfig({...config, storeName: e.target.value})} className="w-full border p-2 rounded outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-500 mb-1">Alamat / Footer</label>
                            <input value={config.storeAddress} onChange={e => setConfig({...config, storeAddress: e.target.value})} className="w-full border p-2 rounded outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-500 mb-1">ImgBB API Key</label>
                            <input value={config.imgbbKey} onChange={e => setConfig({...config, imgbbKey: e.target.value})} className="w-full border p-2 rounded text-sm font-mono outline-none" />
                        </div>
                        <button type="submit" className={`w-full py-2 rounded-lg font-bold text-white transition-all ${saved ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                            {saved ? 'Tersimpan!' : 'Simpan Identitas'}
                        </button>
                    </form>
                </div>

                {/* 3. DATA & PEMBAYARAN */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-lg mb-4 text-green-800 border-b pb-2 flex items-center gap-2">
                        <Save size={20}/> Data & Pembayaran
                    </h3>
                    <div className="space-y-4">
                         {/* QRIS & BANK */}
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Info Bank (Transfer)</label>
                                <textarea value={config.bankAccount} onChange={e => setConfig({...config, bankAccount: e.target.value})} className="w-full border p-2 rounded text-xs h-20" placeholder="BCA..." />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Upload QRIS</label>
                                <div className="flex gap-2">
                                    <div className="w-16 h-16 bg-slate-100 border rounded flex items-center justify-center overflow-hidden">
                                        {config.qrisImage ? <img src={config.qrisImage} className="w-full h-full object-cover"/> : <QrCode size={20} className="text-slate-300"/>}
                                    </div>
                                    <div className="flex-1">
                                        <button onClick={() => qrisInputRef.current.click()} disabled={uploadingQris} className="w-full bg-purple-100 text-purple-700 py-2 rounded text-xs font-bold hover:bg-purple-200">
                                            {uploadingQris ? '...' : 'Upload'}
                                        </button>
                                        <input type="file" ref={qrisInputRef} onChange={handleQrisUpload} className="hidden" accept="image/*" />
                                    </div>
                                </div>
                            </div>
                         </div>
                        
                        <hr className="border-dashed"/>

                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-500">URL Google Apps Script</label>
                            <input value={config.apiUrl} onChange={e => setConfig({...config, apiUrl: e.target.value})} className="w-full border p-2 rounded text-xs font-mono text-slate-600" />
                            <div className="flex gap-2">
                                <button onClick={handlePullData} disabled={loading} className="flex-1 bg-white border border-blue-600 text-blue-700 py-2 rounded text-xs font-bold hover:bg-blue-50">
                                    {loading ? '...' : 'Tarik Data'}
                                </button>
                                <button onClick={handleExcelExport} disabled={loading} className="flex-1 bg-green-600 text-white py-2 rounded text-xs font-bold hover:bg-green-700">
                                    Excel
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={handleBackup} className="bg-slate-700 text-white py-2 rounded text-xs font-bold">Backup JSON</button>
                            <button onClick={handleRestoreClick} className="bg-slate-200 text-slate-700 py-2 rounded text-xs font-bold">Restore JSON</button>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
                        </div>
                         <button onClick={handleFactoryReset} className="w-full mt-2 text-red-500 text-xs hover:underline flex items-center justify-center gap-1">
                            <Trash2 size={12}/> Reset Database Lokal
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default SettingsView;