import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login        from './pages/Login';
import Dashboard    from './pages/Dashboard';
import Analytics    from './pages/Analytics';
import RunDetail    from './pages/RunDetail';
import DeviceControl from './pages/DeviceControl';
import DeviceManager from './pages/DeviceManager';
import Settings     from './pages/Settings';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('access_token');
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard"          element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/analytics"          element={<PrivateRoute><Analytics /></PrivateRoute>} />
        <Route path="/analytics/:runId"   element={<PrivateRoute><RunDetail /></PrivateRoute>} />
        <Route path="/control"            element={<PrivateRoute><DeviceControl /></PrivateRoute>} />
        <Route path="/device-manager"     element={<PrivateRoute><DeviceManager /></PrivateRoute>} />
        <Route path="/settings"           element={<PrivateRoute><Settings /></PrivateRoute>} />
        <Route path="*"                   element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
