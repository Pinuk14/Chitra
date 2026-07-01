import React from 'react';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  className?: string;
  colors?: string[];
}

const DEFAULT_COLORS = ['#000000', '#FF0000', '#22C55E', '#3B82F6', '#EAB308', '#A855F7', '#EC4899'];

export const ColorPicker: React.FC<ColorPickerProps> = ({
  value,
  onChange,
  className = '',
  colors = DEFAULT_COLORS
}) => {
  return (
    <div className={`flex gap-3 p-3 bg-neo-bg shadow-neo-inset rounded-neo w-max overflow-x-auto ${className}`}>
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          style={{ backgroundColor: color }}
          className={`w-8 h-8 rounded-full shrink-0 transition-transform hover:scale-110 active:scale-95 ${
            value === color ? 'shadow-neo-md border-2 border-neo-bg ring-2 ring-neo-accent' : 'shadow-sm border border-transparent'
          }`}
          aria-label={`Select color ${color}`}
        />
      ))}
    </div>
  );
};
