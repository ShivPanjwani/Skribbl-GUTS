import React from 'react';
import { AvatarConfig } from '../types';

interface AvatarProps {
  config: AvatarConfig;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ config, size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-lg',
    lg: 'w-24 h-24 text-4xl',
    xl: 'w-32 h-32 text-6xl',
  };

  const shapeClasses = {
    circle: 'rounded-full',
    square: 'rounded-none',
    rounded: 'rounded-2xl',
  };

  return (
    <div 
      className={`relative flex items-center justify-center shadow-lg border-2 border-white/20 ${sizeClasses[size]} ${shapeClasses[config.shape]} ${className}`}
      style={{ backgroundColor: config.color }}
    >
      <span className="select-none filter drop-shadow-md transform hover:scale-110 transition-transform">
        {config.accessory !== 'None' ? config.accessory : ''}
      </span>
    </div>
  );
};