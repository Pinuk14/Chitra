'use client';

import React, { useEffect, useState } from 'react';
import { Button } from './ui/Button';

export const ThemeToggle: React.FC = () => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    root.classList.toggle('dark');
    setIsDark(root.classList.contains('dark'));
  };

  return (
    <Button onClick={toggleTheme} variant="secondary" className="px-4 py-2 text-sm">
      {isDark ? '☀️ Light' : '🌙 Dark'}
    </Button>
  );
};
