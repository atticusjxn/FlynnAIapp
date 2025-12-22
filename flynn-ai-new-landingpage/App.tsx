import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Layout from './components/Layout';
import LandingPage from './components/LandingPage';
import Sites from './components/Sites';
import { DemoContainer } from './components/demo/DemoContainer';
import PricingPage from './pages/Pricing';
import HowItWorks from './pages/HowItWorks';
import { IndustriesList, IndustryDetail } from './pages/Industries';
import { BlogList, BlogPost } from './pages/Blog';
import Contact from './pages/Contact';

// Placeholder components for new pages
const Features = () => <div className="p-20 text-center text-3xl font-display">Features (Coming Soon)</div>;

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
            <Route path="sites" element={<Sites />} />
            <Route path="pricing" element={<PricingPage />} />
            <Route path="how-it-works" element={<HowItWorks />} />
            <Route path="industries" element={<IndustriesList />} />
            <Route path="industries/:type" element={<IndustryDetail />} />
            <Route path="blog" element={<BlogList />} />
            <Route path="blog/:slug" element={<BlogPost />} />
            <Route path="contact" element={<Contact />} />
            <Route path="features" element={<Features />} />
          </Route>
          {/* Demo runs outside the main layout if needed, or inside. Keeping outside as it might have its own chrome */}
          <Route path="/demo" element={<DemoContainer />} />
        </Routes>
      </BrowserRouter>
    </HelmetProvider >
  );
}

export default App;