import React from 'react';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const InputField: React.FC<InputFieldProps> = ({
  className = '',
  ...props
}) => {
  return (
    <input
      className={`neo-input ${className}`}
      {...props}
    />
  );
};
