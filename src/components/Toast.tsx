import React from 'react';

interface ToastProps {
  message: string | null;
  isVisible: boolean;
}

export const Toast: React.FC<ToastProps> = ({ message, isVisible }) => {
  return (
    <div className={`md3-snackbar ${isVisible ? 'show' : ''}`} role="alert">
      {message}
    </div>
  );
};
