import React, { useState, useEffect } from 'react';
import { Store, User, Lock, ArrowRight, AlertCircle } from 'lucide-react';
// MIGRASI FIREBASE
import { db, collection, query, where, getDocs, addDoc } from '../firebase';

const LoginView = ({ onLogin }) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isFirstRun, setIsFirstRun] = useState(false);

    // CEK USER PERTAMA KALI (AUTO SEED ADMIN)
    useEffect(() => {
        const checkUsers = async () => {
            try {
                const usersRef = collection(db, 'users');
                const snapshot = await getDocs(usersRef);
                
                if (snapshot.empty) {
                    // Jika Cloud kosong, buat Admin default otomatis
                    console.log("Database kosong. Membuat Admin default...");
                    await addDoc(usersRef, {
                        username: 'Admin Toko',
                        pin: '123456',
                        role: 'admin',
                        created_at: new Date().toISOString()
                    });
                    setIsFirstRun(true);
                }
            } catch (e) {
                console.error("Gagal cek user:", e);
                setError("Gagal koneksi ke Cloud. Cek internet.");
            }
        };
        checkUsers();
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Cari User berdasarkan PIN di Firebase
            const q = query(collection(db, 'users'), where('pin', '==', pin));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                const userData = snapshot.docs[0].data();
                onLogin({ ...userData, id: snapshot.docs[0].id });
            } else {
                setError('PIN Salah!');
            }
        } catch (err) {
            console.error(err);
            setError('Terjadi kesalahan koneksi.');
        } finally {
            setLoading(false);
        }
    };

    const handleNumClick = (num) => {
        if (pin.length < 6) setPin(prev => prev + num);
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white font-sans overflow-hidden relative">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600 rounded-full blur-[100px]"></div>
            </div>

            <div className="w-full max-w-md p-8 z-10 animate-scale-up">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-800 rounded-2xl mb-4 shadow-2xl shadow-blue-900/50 border border-slate-700">
                        <Store size={40} className="text-blue-400" />
                    </div>
                    <h1 className="text-3xl font-black tracking-tight mb-2">RUKO POS <span className="text-blue-400">CLOUD</span></h1>
                    <p className="text-slate-400">Masuk untuk memulai kasir</p>
                </div>

                {isFirstRun && (
                    <div className="mb-6 p-4 bg-green-900/30 border border-green-500/30 rounded-xl flex items-center gap-3 text-green-400 text-sm animate-pulse">
                        <AlertCircle size={20}/>
                        <div>
                            <b>Admin Default Dibuat!</b>
                            <br/>Gunakan PIN: 123456
                        </div>
                    </div>
                )}

                <div className="bg-slate-800/50 backdrop-blur-md p-6 rounded-3xl border border-slate-700 shadow-xl">
                    <form onSubmit={handleLogin} className="mb-6">
                        <div className="relative mb-6">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Lock className="text-slate-500" size={20} />
                            </div>
                            <input 
                                type="password" 
                                value={pin} 
                                readOnly // Keyboard Only
                                className="w-full pl-12 pr-4 py-4 bg-slate-900/50 border border-slate-600 rounded-xl text-center text-2xl font-bold tracking-[0.5em] text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-600 placeholder:font-normal placeholder:tracking-normal placeholder:text-sm" 
                                placeholder="Masukkan PIN" 
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-3 mb-6">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                <button type="button" key={num} onClick={() => handleNumClick(num.toString())} className="h-16 rounded-xl bg-slate-700/50 hover:bg-slate-600 border border-slate-600/50 text-2xl font-bold transition-all active:scale-95">{num}</button>
                            ))}
                            <button type="button" onClick={() => setPin('')} className="h-16 rounded-xl bg-red-900/30 hover:bg-red-900/50 border border-red-500/30 text-red-400 font-bold text-sm">C</button>
                            <button type="button" onClick={() => handleNumClick('0')} className="h-16 rounded-xl bg-slate-700/50 hover:bg-slate-600 border border-slate-600/50 text-2xl font-bold">0</button>
                            <button type="submit" disabled={loading} className="h-16 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-all active:scale-95 disabled:bg-slate-600">
                                {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <ArrowRight size={28} />}
                            </button>
                        </div>
                    </form>
                    {error && <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-center text-sm font-bold">{error}</div>}
                </div>
                <div className="text-center mt-6 text-slate-500 text-xs font-mono">
                    v6.0.0 (Cloud Edition)
                </div>
            </div>
        </div>
    );
};

export default LoginView;