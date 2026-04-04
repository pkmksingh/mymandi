/**
 * Transforms Cloudinary URLs to optimize for performance:
 * - c_fill: Crops the image to fill the given dimensions
 * - q_auto: Automatically optimizes image quality
 * - f_auto: Automatically serves the best format (WebP/AVIF)
 * - w, h: Sets specific dimensions
 */
export const getOptimizedImage = (url, width = 400, height = 300) => {
  if (!url || typeof url !== 'string') return url;
  
  // Only transform Cloudinary URLs
  if (url.includes('cloudinary.com')) {
    const parts = url.split('/upload/');
    if (parts.length === 2) {
      const transform = `c_fill,g_auto,w_${width},h_${height},q_auto,f_auto/`;
      return `${parts[0]}/upload/${transform}${parts[1]}`;
    }
  }
  
  return url;
};

export const getProfileThumb = (url) => {
  return getOptimizedImage(url, 100, 100);
};
