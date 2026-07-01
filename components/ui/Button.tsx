import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className = '',
  variant = 'primary',
  ...props
}) => {
  return (
    <button
      className={`neo-button ${variant === 'secondary' ? 'opacity-75' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
