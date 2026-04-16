import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

/** Speech bubble with eclipse crescent inside and a small glow dot */
export const IconChat: React.FC<IconProps> = ({ size = 20, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Speech bubble */}
    <path
      d="M3 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8l-3.5 2.5A.5.5 0 0 1 4 16.2V14H5a2 2 0 0 1-2-2V4Z"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
    {/* Eclipse crescent inside bubble */}
    <circle cx="10" cy="8" r="3" stroke="currentColor" strokeWidth={1.5} />
    <circle cx="11.2" cy="8" r="2.4" fill="currentColor" opacity={0.15} />
    {/* Glow dot */}
    <circle cx="7.5" cy="6.5" r="0.8" fill="#6BA3FF" />
  </svg>
);

/** Two crossed beams with an eclipse ring at the intersection */
export const IconArena: React.FC<IconProps> = ({ size = 20, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Crossed beams */}
    <line x1="4" y1="4" x2="16" y2="16" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    <line x1="16" y1="4" x2="4" y2="16" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    {/* Eclipse ring at intersection */}
    <circle cx="10" cy="10" r="3.2" stroke="#6BA3FF" strokeWidth={1.5} />
    <circle cx="10" cy="10" r="1.8" fill="currentColor" opacity={0.2} />
  </svg>
);

/** Document with layered pages and a magnifying eclipse ring overlay */
export const IconRAG: React.FC<IconProps> = ({ size = 20, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Back page */}
    <rect x="5" y="1.5" width="11" height="14" rx="1.5" stroke="currentColor" strokeWidth={1.2} opacity={0.35} />
    {/* Front page */}
    <rect x="3" y="3" width="11" height="14" rx="1.5" stroke="currentColor" strokeWidth={1.5} />
    {/* Text lines */}
    <line x1="5.5" y1="6.5" x2="11.5" y2="6.5" stroke="currentColor" strokeWidth={1} strokeLinecap="round" opacity={0.5} />
    <line x1="5.5" y1="9" x2="10" y2="9" stroke="currentColor" strokeWidth={1} strokeLinecap="round" opacity={0.5} />
    <line x1="5.5" y1="11.5" x2="11.5" y2="11.5" stroke="currentColor" strokeWidth={1} strokeLinecap="round" opacity={0.5} />
    {/* Magnifying eclipse ring */}
    <circle cx="14" cy="14" r="3" stroke="#6BA3FF" strokeWidth={1.5} />
    <line x1="16.2" y1="16.2" x2="18" y2="18" stroke="#6BA3FF" strokeWidth={1.5} strokeLinecap="round" />
  </svg>
);

/** Code brackets with an eclipse eye between them */
export const IconCodeReview: React.FC<IconProps> = ({ size = 20, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Left bracket < */}
    <polyline points="6,5 2,10 6,15" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    {/* Right bracket > */}
    <polyline points="14,5 18,10 14,15" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    {/* Eclipse eye — outer almond shape */}
    <path
      d="M7 10c0 0 1.5-2.5 3-2.5s3 2.5 3 2.5-1.5 2.5-3 2.5S7 10 7 10Z"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinejoin="round"
    />
    {/* Eclipse eye — iris ring */}
    <circle cx="10" cy="10" r="1.2" stroke="#6BA3FF" strokeWidth={1.2} />
    {/* Pupil */}
    <circle cx="10" cy="10" r="0.5" fill="currentColor" />
  </svg>
);

/** Fountain pen nib with a glowing ink drop */
export const IconCopywriter: React.FC<IconProps> = ({ size = 20, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Pen nib body */}
    <path
      d="M10 2L6 12l4 4 4-4L10 2Z"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
    {/* Center slit */}
    <line x1="10" y1="5" x2="10" y2="11" stroke="currentColor" strokeWidth={1} strokeLinecap="round" opacity={0.5} />
    {/* Nib tip */}
    <line x1="10" y1="16" x2="10" y2="18.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    {/* Glowing ink drop */}
    <circle cx="10" cy="18.5" r="1" fill="#6BA3FF" />
  </svg>
);

/** Shield with eclipse silhouette (dark disc + corona) */
export const IconSecurity: React.FC<IconProps> = ({ size = 20, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Shield */}
    <path
      d="M10 1.5L3 4.5v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9v-5L10 1.5Z"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
    {/* Corona ring */}
    <circle cx="10" cy="9.5" r="3.2" stroke="#6BA3FF" strokeWidth={1.3} />
    {/* Dark disc (eclipse body) */}
    <circle cx="10" cy="9.5" r="2.2" fill="currentColor" opacity={0.25} />
  </svg>
);

/** Landscape frame with a sun being eclipsed */
export const IconImageStudio: React.FC<IconProps> = ({ size = 20, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Frame */}
    <rect x="2" y="3" width="16" height="14" rx="2" stroke="currentColor" strokeWidth={1.5} />
    {/* Mountain landscape */}
    <polyline points="2,15 7,9 11,13 14,10 18,15" stroke="currentColor" strokeWidth={1.2} strokeLinejoin="round" opacity={0.5} />
    {/* Eclipsed sun — corona */}
    <circle cx="14" cy="7" r="2.2" stroke="#6BA3FF" strokeWidth={1.3} />
    {/* Eclipse disc over sun */}
    <circle cx="14.8" cy="6.5" r="1.8" fill="currentColor" opacity={0.2} />
  </svg>
);

/** Gear with eclipse crescent cut-out */
export const IconSettings: React.FC<IconProps> = ({ size = 20, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Gear teeth via path */}
    <path
      d="M8.5 2h3l.4 2.1a5.5 5.5 0 0 1 1.6.9l2-.7 1.5 2.6-1.6 1.4a5.5 5.5 0 0 1 0 1.8l1.6 1.4-1.5 2.6-2-.7a5.5 5.5 0 0 1-1.6.9L11.5 18h-3l-.4-2.1a5.5 5.5 0 0 1-1.6-.9l-2 .7-1.5-2.6 1.6-1.4a5.5 5.5 0 0 1 0-1.8L3 8.5l1.5-2.6 2 .7a5.5 5.5 0 0 1 1.6-.9L8.5 2Z"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
    {/* Center circle */}
    <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth={1.5} />
    {/* Eclipse crescent accent */}
    <path
      d="M11.5 8.5a2 2 0 0 1 0 3"
      stroke="#6BA3FF"
      strokeWidth={1.3}
      strokeLinecap="round"
    />
  </svg>
);

/** Eclipse Forge logo — dark disc with glowing corona ring and diamond ring point */
export const IconEclipseLogo: React.FC<IconProps> = ({ size = 20, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Corona ring */}
    <circle cx="10" cy="10" r="7" stroke="#6BA3FF" strokeWidth={1.5} />
    {/* Dark disc */}
    <circle cx="10" cy="10" r="5" fill="currentColor" opacity={0.3} />
    {/* Inner shadow crescent */}
    <path
      d="M12 5.5A5 5 0 0 1 12 14.5 5 5 0 0 0 12 5.5Z"
      fill="currentColor"
      opacity={0.15}
    />
    {/* Diamond ring point — bright flare */}
    <circle cx="16.5" cy="7" r="1.2" fill="#6BA3FF" />
    <circle cx="16.5" cy="7" r="0.5" fill="white" />
  </svg>
);
