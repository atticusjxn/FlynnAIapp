import React from 'react';
import { Link } from 'react-router-dom';

/*
 * Flynn is parked, so every store CTA now leads to the waitlist. Keeping this
 * component means each page that rendered store badges switches over together.
 */

interface StoreButtonsProps {
    variant?: 'dock' | 'hero';
}

const StoreButtons: React.FC<StoreButtonsProps> = ({ variant = 'dock' }) => (
    <Link
        to="/start"
        className={`flynn-glass flynn-glass--primary flynn-pill inline-flex items-center gap-3 font-display font-bold ${
            variant === 'hero' ? 'px-9 py-4 text-lg' : 'px-6 py-3'
        }`}
    >
        Join the waitlist
    </Link>
);

export default StoreButtons;
