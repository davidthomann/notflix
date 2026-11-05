import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react';

interface ArtProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string;
  /** Called once the image has failed, so the caller can show a text fallback instead. */
  onFail?: () => void;
  /** Called when the image is ready to be seen. */
  onReady?: () => void;
}

/** Artwork that fades in when decoded instead of popping in line by line. */
export function Art({ src, onFail, onReady, className, alt = '', ...rest }: ArtProps) {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setLoaded(false);
    // Cached images may finish before React attaches onLoad.
    if (ref.current?.complete && ref.current.naturalWidth > 0) {
      setLoaded(true);
      onReady?.();
    }
    // Only a new source restarts the fade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return (
    <img
      {...rest}
      ref={ref}
      src={src}
      alt={alt}
      className={`art${loaded ? ' is-loaded' : ''}${className ? ` ${className}` : ''}`}
      draggable={false}
      onLoad={() => {
        setLoaded(true);
        onReady?.();
      }}
      onError={() => onFail?.()}
    />
  );
}
