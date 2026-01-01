import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Layout from './components/Layout';
import LandingPage from './components/LandingPage';

import { DemoContainer } from './components/demo/DemoContainer';
import PricingPage from './pages/Pricing';
import HowItWorks from './pages/HowItWorks';
import { IndustriesList, IndustryDetail } from './pages/Industries';
import { BlogList, BlogPost } from './pages/Blog';
import Contact from './pages/Contact';
import Trial from './pages/Trial';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Setup from './pages/Setup';
import DashboardLayout from './components/DashboardLayout';

import Features from './components/Features';

// Component to handle external scripts like Analytics
const Analytics = () => {
  return (
    <div style={{ display: 'none' }}>
      {/* Google Analytics Placeholder - ID: G-XXXXXXXXXX */}
      {/* Plausible Analytics Placeholder */}
    </div>
  );
}

function App() {
  return (
    <HelmetProvider>
      <Analytics />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<LandingPage />} />

            <Route path="pricing" element={<PricingPage />} />
            <Route path="how-it-works" element={<HowItWorks />} />
            <Route path="industries" element={<IndustriesList />} />
            <Route path="industries/:type" element={<IndustryDetail />} />
            <Route path="blog" element={<BlogList />} />
            <Route path="blog/:slug" element={<BlogPost />} />
            <Route path="contact" element={<Contact />} />
            <Route path="trial" element={<Trial />} />
            <Route path="features" element={<Features />} />
          </Route>

          <Route path="/login" element={<Login />} />

          <Route path="/dashboard" element={<DashboardLayout><Dashboard /></DashboardLayout>} />
          <Route path="/dashboard/setup" element={<DashboardLayout><Setup /></DashboardLayout>} />
          <Route path="/dashboard/*" element={<DashboardLayout><Dashboard /></DashboardLayout>} /> {/* Fallback for other dashboard items */}

          {/* Demo runs outside the main layout if needed, or inside. Keeping outside as it might have its own chrome */}
          <Route path="/demo" element={<DemoContainer />} />
        </Routes>
      </BrowserRouter>
    </HelmetProvider >
  );
}

export default App;