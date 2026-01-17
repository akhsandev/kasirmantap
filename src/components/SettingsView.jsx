import React, { useState, useEffect } from 'react';
import { db, collection, getDocs, doc, setDoc, addDoc, deleteDoc, writeBatch } from '../firebase';
import { Settings, Save, Database, User, Trash2, Plus, Image as ImageIcon, UploadCloud, AlertTriangle, Upload } from 'lucide-react';

const SettingsView = () => {
    // STATE SETTING TOKO
    const [storeName, setStoreName] = useState('');
    const [storeAddress, setStoreAddress] = useState('');
    const [qrisImage, setQrisImage] = useState('');
    const [bankAccount, setBankAccount] = useState('');
    const [apiUrl, setApiUrl] = useState(''); 
    const [imgbbKey, setImgbbKey] = useState(''); 
    
    // STATE SYSTEM
    const [uploading, setUploading] = useState(false);
    const [restoring, setRestoring] = useState(false); 

    // STATE MANAJEMEN USER
    const [users, setUsers] = useState([]);
    const [newUser, setNewUser] = useState({ username: '', pin: '', role: 'kasir' });

    useEffect(() => {
        loadSettings();
        loadUsers();
    }, []);

    const loadSettings = async () => {
        try {
            const snap = await getDocs(collection(db, 'settings'));
            const data = {};
            snap.forEach(doc => { data[doc.id] = doc.data().value });
            
            setStoreName(data['storeName'] || '');
            setStoreAddress(data['storeAddress'] || '');
            setQrisImage(data['qrisImage'] || '');
            setBankAccount(data['bankAccount'] || '');
            setApiUrl(data['apiUrl'] || '');
            setImgbbKey(data['imgbbKey'] || ''); 
        } catch (e) { console.error(e); }
    };

    const loadUsers = async () => {
        try {
            const snap = await getDocs(collection(db, 'users'));
            setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { console.error(e); }
    };

    const saveSetting = async (key, value) => {
        await setDoc(doc(db, 'settings', key), { value });
    };

    const handleSaveAll = async () => {
        try {
            await Promise.all([
                saveSetting('storeName', storeName),
                saveSetting('storeAddress', storeAddress),
                saveSetting('qrisImage', qrisImage),
                saveSetting('bankAccount', bankAccount),
                saveSetting('apiUrl', apiUrl),
                saveSetting('imgbbKey', imgbbKey),
            ]);
            alert('Pengaturan Tersimpan di Cloud!');
        } catch (e) { alert("Gagal simpan: " + e.message); }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!imgbbKey) return alert("Masukkan API Key Imgbb dulu & Simpan!");

        setUploading(true);
        const formData = new FormData();
        formData.append("image", file);

        try {
            const res = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, {
                method: "POST",
                body: formData,
            });
            const data = await res.json();
            if (data.success) {
                setQrisImage(data.data.url); 
                alert("Upload Berhasil! Silakan edit URL jika gambar tidak muncul.");
            } else {
                alert("Gagal Upload: " + (data.error?.message || "Error Imgbb"));
            }
        } catch (error) {
            alert("Error Koneksi Upload");
        } finally {
            setUploading(false);
        }
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        if(!newUser.username || !newUser.pin) return;
        try {
            await addDoc(collection(db, 'users'), { ...newUser, created_at: new Date().toISOString() });
            setNewUser({ username: '', pin: '', role: 'kasir' });
            loadUsers();
        } catch (e) { alert("Gagal tambah user: " + e.message); }
    };

    const handleDeleteUser = async (id) => {
        if(confirm('Hapus user ini?')) {
            await deleteDoc(doc(db, 'users', id));
            loadUsers();
        }
    };

    const handleBackup = async () => {
        if(!confirm('Download backup data dari Cloud?')) return;
        try {
            const [prods, txs, custs, debts, exps] = await Promise.all([
                getDocs(collection(db, 'products')),
                getDocs(collection(db, 'transactions')),
                getDocs(collection(db, 'customers')),
                getDocs(collection(db, 'debts')),
                getDocs(collection(db, 'expenses'))
            ]);

            const allData = {
                products: prods.docs.map(d => ({ id: d.id, ...d.data() })), 
                transactions: txs.docs.map(d => ({ id: d.id, ...d.data() })),
                customers: custs.docs.map(d => ({ id: d.id, ...d.data() })),
                debts: debts.docs.map(d => ({ id: d.id, ...d.data() })),
                expenses: exps.docs.map(d => ({ id: d.id, ...d.data() })),
                exported_at: new Date().toISOString()
            };

            const blob = new Blob([JSON.stringify(allData)], {type: "application/json"});
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `RukoPOS_CloudBackup_${new Date().toISOString().slice(0,10)}.json`;
            link.click();
        } catch (e) { alert("Gagal backup: " + e.message); }
    };

    const handleRestore = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!confirm("PERINGATAN KERAS!\n\nApakah Anda yakin ingin me-restore data?\nData yang ada di file JSON akan ditambahkan/menimpa data di Cloud.\n\nPastikan file JSON ini valid.")) {
            e.target.value = null; 
            return;
        }

        setRestoring(true);
        const reader = new FileReader();
        
        reader.onload = async (event) => {
            try {
                const jsonData = JSON.parse(event.target.result);
                
                const batchUpload = async (collName, dataArray) => {
                    if (!dataArray || dataArray.length === 0) return;
                    const chunkSize = 400; 
                    for (let i = 0; i < dataArray.length; i += chunkSize) {
                        const chunk = dataArray.slice(i, i + chunkSize);
                        const batch = writeBatch(db);
                        chunk.forEach(item => {
                            const ref = doc(db, collName, item.id || Date.now().toString());
                            const { id, ...dataContent } = item; 
                            batch.set(ref, dataContent, { merge: true }); 
                        });
                        await batch.commit();
                    }
                };

                await batchUpload('products', jsonData.products);
                await batchUpload('transactions', jsonData.transactions);
                await batchUpload('customers', jsonData.customers);
                await batchUpload('debts', jsonData.debts);
                await batchUpload('expenses', jsonData.expenses);

                alert("RESTORE BERHASIL!\nData Cloud telah diperbarui dari file JSON.");
                window.location.reload(); 

            } catch (err) {
                console.error(err);
                alert("Gagal Restore: File JSON rusak atau koneksi putus.");
            } finally {
                setRestoring(false);
                e.target.value = null;
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 p-6 overflow-y-auto">
            <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 mb-6"><Settings className="text-blue-600"/> Pengaturan (Cloud Mode)</h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><StoreIcon/> Identitas Toko</h3>
                    <div className="space-y-4">
                        <div><label className="text-xs font-bold text-slate-500">Nama Toko</label><input value={storeName} onChange={e => setStoreName(e.target.value)} className="w-full border p-2 rounded" /></div>
                        <div><label className="text-xs font-bold text-slate-500">Alamat / Footer Struk</label><input value={storeAddress} onChange={e => setStoreAddress(e.target.value)} className="w-full border p-2 rounded" /></div>
                        
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <label className="text-xs font-bold text-blue-600 mb-2 flex items-center gap-1"><ImageIcon size={12}/> Gambar QRIS (Upload/Edit)</label>
                            
                            <div className="mb-2">
                                <label className="text-[10px] font-bold text-slate-400">1. Masukkan API Key Imgbb</label>
                                <input value={imgbbKey} onChange={e => setImgbbKey(e.target.value)} className="w-full border p-1.5 rounded text-xs mb-1" placeholder="Paste API Key Imgbb disini..." />
                            </div>

                            <div className="flex gap-2 items-center">
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-slate-400">2. Pilih Gambar QRIS</label>
                                    <input type="file" accept="image/*" onChange={handleImageUpload} disabled={!imgbbKey || uploading} className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                                </div>
                                {uploading && <div className="text-xs font-bold text-blue-600 animate-pulse">Upload...</div>}
                            </div>

                            <div className="mt-2">
                                <label className="text-[10px] font-bold text-slate-400">3. URL Gambar (Bisa Diedit Manual)</label>
                                {/* SAYA HAPUS READONLY SUPAYA BISA DIEDIT */}
                                <input value={qrisImage} onChange={e => setQrisImage(e.target.value)} className="w-full border p-2 rounded text-xs bg-white text-slate-700 font-mono" placeholder="https://..." />
                                <p className="text-[10px] text-slate-400 mt-1">Jika gambar tidak muncul, coba edit URL (misal: ganti domain).</p>
                            </div>
                            {qrisImage && (
                                <div className="mt-2 flex flex-col items-center border bg-white rounded p-2">
                                    <img src={qrisImage} alt="Preview QRIS" className="h-24 object-contain" onError={(e) => {e.target.src='https://placehold.co/100?text=Error';}}/>
                                    <span className="text-[10px] text-slate-400 mt-1">Preview</span>
                                </div>
                            )}
                        </div>

                        <div><label className="text-xs font-bold text-slate-500">Info Rekening Bank (Text)</label><textarea value={bankAccount} onChange={e => setBankAccount(e.target.value)} className="w-full border p-2 rounded h-20" placeholder="BCA 12345 a/n Budi" /></div>
                        
                        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                            <label className="text-xs font-bold text-green-700 mb-1 flex items-center gap-1"><UploadCloud size={12}/> Backup Google Sheet</label>
                            <input value={apiUrl} onChange={e => setApiUrl(e.target.value)} className="w-full border p-2 rounded text-xs" placeholder="https://script.google.com/macros/s/..." />
                        </div>

                        <button onClick={handleSaveAll} className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 flex justify-center gap-2"><Save size={18}/> Simpan Perubahan</button>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><User/> Manajemen User</h3>
                    <form onSubmit={handleAddUser} className="flex gap-2 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <input value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} placeholder="Nama User" className="flex-1 border p-2 rounded text-sm" required />
                        <input value={newUser.pin} onChange={e => setNewUser({...newUser, pin: e.target.value})} placeholder="PIN" type="number" className="w-24 border p-2 rounded text-sm" required />
                        <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className="border p-2 rounded text-sm"><option value="kasir">Kasir</option><option value="admin">Admin</option></select>
                        <button type="submit" className="bg-green-600 text-white p-2 rounded hover:bg-green-700"><Plus size={18}/></button>
                    </form>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {users.map(u => (
                            <div key={u.id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-slate-50">
                                <div><div className="font-bold text-slate-700">{u.username}</div><div className="text-xs text-slate-400">PIN: {u.pin} • Role: {u.role}</div></div>
                                <button onClick={() => handleDeleteUser(u.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-2">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Database/> Kontrol Database (Penting)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-5 bg-blue-50 border border-blue-200 rounded-xl">
                            <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2"><Save size={18}/> Backup Data</h4>
                            <p className="text-xs text-blue-600 mb-4">Download semua data (Produk, Transaksi, Pelanggan, dll) dari Cloud ke komputer Anda dalam format file <b>.JSON</b>.</p>
                            <button onClick={handleBackup} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 flex justify-center gap-2 shadow-lg shadow-blue-200">Download Backup (.JSON)</button>
                        </div>
                        <div className="p-5 bg-red-50 border border-red-200 rounded-xl relative overflow-hidden">
                            {restoring && <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center font-bold text-red-600 animate-pulse">Sedang Memulihkan Data...</div>}
                            <h4 className="font-bold text-red-800 mb-2 flex items-center gap-2"><AlertTriangle size={18}/> Restore Data</h4>
                            <p className="text-xs text-red-600 mb-4">Masukkan file <b>.JSON</b> untuk mengembalikan data yang hilang. <br/><b>Hati-hati:</b> Data di file akan digabungkan ke Cloud.</p>
                            <label className="w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 flex justify-center gap-2 shadow-lg shadow-red-200 cursor-pointer transition-all active:scale-95"><Upload size={18}/><span>{restoring ? 'Memproses...' : 'Pilih File JSON & Restore'}</span><input type="file" accept=".json" onChange={handleRestore} disabled={restoring} className="hidden" /></label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
const StoreIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>);
export default SettingsView;