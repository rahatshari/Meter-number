import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';

interface UserAvatarProps {
  user: User | null;
  size?: number;
  className?: string;
  showStatusDot?: boolean;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  size = 36,
  className = '',
  showStatusDot = false,
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [user?.photoURL]);

  const getInitial = (): string => {
    if (!user) return '👤';
    const name = (user.displayName || user.email || '').trim();
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };

  const initial = getInitial();
  const hasValidPhoto = Boolean(user?.photoURL && !imgError);

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          overflow: 'hidden',
          backgroundColor: hasValidPhoto
            ? 'transparent'
            : 'var(--md-sys-color-primary-container)',
          color: 'var(--md-sys-color-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: size > 48 ? '26px' : size > 32 ? '15px' : '13px',
          border: '1.5px solid var(--md-sys-color-primary-container)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        {hasValidPhoto ? (
          <img
            src={user!.photoURL!}
            alt={user!.displayName || user!.email || 'ব্যবহারকারী'}
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            loading="lazy"
            onError={() => {
              // Gracefully switch to monogram initial if Google CDN blocks cross-origin or fails
              setImgError(true);
            }}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '50%',
            }}
          />
        ) : (
          <span style={{ userSelect: 'none', lineHeight: 1 }}>{initial}</span>
        )}
      </div>

      {showStatusDot && user && (
        <span
          style={{
            position: 'absolute',
            top: '0px',
            right: '0px',
            width: size > 40 ? '11px' : '9px',
            height: size > 40 ? '11px' : '9px',
            borderRadius: '50%',
            backgroundColor: 'var(--md-sys-color-success)',
            border: '2px solid var(--md-sys-color-surface)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
          }}
          title="অনলাইন সিঙ্ক সক্রিয়"
        />
      )}
    </div>
  );
};
