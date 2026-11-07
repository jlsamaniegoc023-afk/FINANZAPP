import React, { useState } from 'react';
import carlosAvatarUrl from '../assets/images/avatar_carlos_mendoza_1793756620432.jpg';
import anaAvatarUrl from '../assets/images/avatar_ana_martinez_1793756619281.jpg';

const AVATAR_MAP: Record<string, string | undefined> = {
  carlos: carlosAvatarUrl,
  ana: anaAvatarUrl,
};

interface UserAvatarProps {
  name: string;
  avatarKey?: string;
  sizeClass?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  avatarKey,
  sizeClass = 'w-9 h-9 text-xs',
}) => {
  const [failed, setFailed] = useState(false);
  const src = avatarKey ? AVATAR_MAP[avatarKey] : undefined;

  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  if (!src || failed) {
    return (
      <div
        className={`${sizeClass} rounded-lg bg-[#1C314E] text-white font-semibold flex items-center justify-center shrink-0 select-none border border-white/15`}
        aria-label={name}
      >
        {initials || 'US'}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`Foto de perfil de ${name}`}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${sizeClass} rounded-lg object-cover shrink-0 border border-slate-200/60`}
    />
  );
};
