/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import Viewer from './components/Viewer';
import AdminPanel from './components/AdminPanel';
import Login from './components/Login';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-baby-pink-light">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-baby-pink"></div>
      </div>
    );
  }

  const isAdmin = user?.email === 'marco@thed2dexperts.com';

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Viewer />} />
        <Route path="/scan" element={<Viewer />} />
        <Route 
          path="/admin" 
          element={
            isAdmin ? <AdminPanel user={user} /> : <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/login" 
          element={
            isAdmin ? <Navigate to="/admin" replace /> : <Login />
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
