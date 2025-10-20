"use client";

import { motion } from "framer-motion";
import { buttonPress } from "@/lib/animations";

interface ButtonProps {
  variant?: "primary" | "secondary";
  size?: "small" | "medium" | "large";
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
}

export default function Button({
  variant = "primary",
  size = "medium",
  children,
  className = "",
  disabled,
  type = "button",
  onClick,
}: ButtonProps) {
  const baseStyles = "rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2";

  const variantStyles = {
    primary: "bg-brand-blue text-white hover:bg-[#1e3a8a] shadow-md hover:shadow-lg",
    secondary: "bg-white text-brand-blue border-2 border-gray-200 hover:border-brand-blue shadow-sm",
  };

  const sizeStyles = {
    small: "px-4 py-2 text-sm",
    medium: "px-6 py-3 text-base",
    large: "px-8 py-4 text-lg",
  };

  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      } ${className}`}
      whileTap={disabled ? undefined : buttonPress}
    >
      {children}
    </motion.button>
  );
}
