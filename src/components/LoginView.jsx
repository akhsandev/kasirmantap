import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { Lock, User, CheckCircle, AlertCircle, Delete } from 'lucide-react';

const LoginView = ({ onLogin }) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleNumClick = (num) => {
        if (pin.length < 6) {
            setPin(prev => prev + num);
            setError('');
        }
    };

    const handleBackspace = () => {
        setPin(prev => prev.slice(0, -1));
        setError('');
    };

    const handleLogin = async () => {
        if (!pin) return;
        setLoading(true);
        
        // Cek ke Database
        const user = await db.users.where('pin').equals(pin).first();

        if (user) {
            // Login Sukses
            setLoading(false);
            onLogin(user);
        } else {
            // Login Gagal
            setLoading(false);
            setError('PIN Salah! Coba lagi.');
            setPin('');
        }
    };

    // Auto-submit jika PIN sudah 6 digit (Opsional, tapi enak buat UX)
    useEffect(() => {
        if (pin.length === 6) handleLogin();
    }, [pin]);

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="bg-blue-600 p-8 text-center text-white">
                    <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                        <Lock size={32} />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">RUKO POS v6</h2>
                    <p className="text-blue-200 text-sm mt-1">Silakan Masuk untuk Akses</p>
                </div>

                {/* Layar PIN */}
                <div className="p-6">
                    {/* Display PIN (Dots) */}
                    <div className="bg-slate-100 h-16 rounded-xl flex items-center justify-center gap-3 mb-6 border border-slate-200">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className={`w-4 h-4 rounded-full transition-all duration-300 ${i < pin.length ? 'bg-slate-800 scale-110' : 'bg-slate-300 scale-90'}`}></div>
                        ))}
                    </div>

                    {error && (
                        <div className="flex items-center justify-center gap-2 text-red-500 text-sm font-bold mb-4 animate-pulse">
                            <AlertCircle size={16}/> {error}
                        </div>
                    )}

                    {/* Numpad */}
                    <div className="grid grid-cols-3 gap-3">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                            <button 
                                key={num} 
                                onClick={() => handleNumClick(num.toString())}
                                className="h-14 rounded-lg bg-slate-50 border border-slate-200 text-xl font-bold text-slate-700 hover:bg-blue-50 hover:border-blue-300 active:scale-95 transition-all"
                            >
                                {num}
                            </button>
                        ))}
                        <button className="h-14 flex items-center justify-center text-slate-400 font-bold" disabled>_</button>
                        <button 
                            onClick={() => handleNumClick('0')}
                            className="h-14 rounded-lg bg-slate-50 border border-slate-200 text-xl font-bold text-slate-700 hover:bg-blue-50 hover:border-blue-300 active:scale-95 transition-all"
                        >
                            0
                        </button>
                        <button 
                            onClick={handleBackspace}
                            className="h-14 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center text-red-500 hover:bg-red-100 active:scale-95 transition-all"
                        >
                            <Delete size={24}/>
                        </button>
                    </div>

                    <button 
                        onClick={handleLogin}
                        disabled={loading}
                        className="w-full mt-6 bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 shadow-lg shadow-blue-200 active:scale-[0.98] transition-all"
                    >
                        {loading ? 'Memproses...' : 'MASUK SEKARANG'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LoginView;