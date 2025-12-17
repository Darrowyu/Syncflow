import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768; // md断点

export const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT);

  useEffect(() => {
    const handleResize = (): void => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
};

export default useIsMobile;
