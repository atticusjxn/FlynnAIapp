import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthGate } from './components/AuthGate';
import { Layout } from './components/Layout';
import { Today } from './pages/Today';
import { ColdEmailQueue } from './pages/ColdEmailQueue';
import { IGQueue } from './pages/IGQueue';
import { FBQueue } from './pages/FBQueue';
import { Leads } from './pages/Leads';
import { Metrics } from './pages/Metrics';
import { Settings } from './pages/Settings';

export default function App() {
  return (
    <AuthGate>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Today />} />
          <Route path="queue/cold-email" element={<ColdEmailQueue />} />
          <Route path="queue/ig-dms" element={<IGQueue />} />
          <Route path="queue/fb-groups" element={<FBQueue />} />
          <Route path="leads" element={<Leads />} />
          <Route path="metrics" element={<Metrics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthGate>
  );
}
