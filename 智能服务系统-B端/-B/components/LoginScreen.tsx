
import React, { useState } from 'react';
import { Lock, Mail, Loader2, Sparkles, Building2 } from 'lucide-react';
import { signIn } from '../lib/supabaseClient';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error } = await signIn(email, password);
      
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setError('邮箱或密码错误，请重试。');
        } else {
          setError(error.message);
        }
      } else if (data.session) {
        onLoginSuccess();
      }
    } catch (err) {
      setError('登录发生意外错误');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-lg shadow-xl overflow-hidden border border-slate-200">
        {/* Header - Professional Slate Dark */}
        <div className="bg-slate-900 p-8 text-center">
          <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/10">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-wide">CRIMS 管理后台</h1>
          <p className="text-slate-400 text-sm mt-2">企业级智能客户关系管理系统</p>
        </div>

        {/* Form */}
        <div className="p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">管理员邮箱</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-900 text-sm"
                  placeholder="admin@crims.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-900 text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-100 flex items-center gap-2">
                <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-semibold shadow-sm hover:bg-blue-700 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> 登录中...
                </>
              ) : (
                '安全登录'
              )}
            </button>
          </form>
          
          <div className="mt-6 text-center border-t border-slate-100 pt-4">
             <p className="text-xs text-slate-400">
               © 2024 CRIMS Enterprise. All rights reserved.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;