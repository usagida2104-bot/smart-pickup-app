"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface AuthContextType {
  isAuthenticated: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    const authFlag = localStorage.getItem("isAuthenticated");
    if (authFlag === "true") {
      setIsAuthenticated(true);
    }
    setIsMounted(true);
  }, []);

  const login = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === "pokke" && password === "andante") {
      setIsAuthenticated(true);
      localStorage.setItem("isAuthenticated", "true");
      setError(false);
    } else {
      setError(true);
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem("isAuthenticated");
    setUsername("");
    setPassword("");
    setError(false);
  };

  if (!isMounted) return null;

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]">
        <div className="bg-[#1c1c1e] text-gray-100 rounded-2xl p-6 w-full max-w-[380px] shadow-2xl">
          <h2 className="text-lg font-bold mb-2">放デイ 送迎表システム にサインイン</h2>
          <p className="text-sm text-gray-400 mb-6">
            パスワードは暗号化されずに送信されます。
          </p>
          
          <form onSubmit={login} className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="ユーザ名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#2c2c2e] border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                autoFocus
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="パスワード"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#2c2c2e] border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs font-medium pt-1">
                ユーザ名またはパスワードが正しくありません
              </p>
            )}

            <div className="flex items-center justify-end gap-4 pt-2">
              <button
                type="button"
                className="text-sm font-semibold text-blue-500 hover:text-blue-400 transition-colors"
                onClick={() => {
                  setUsername("");
                  setPassword("");
                  setError(false);
                }}
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="text-sm font-semibold text-blue-500 hover:text-blue-400 transition-colors"
              >
                サインイン
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
