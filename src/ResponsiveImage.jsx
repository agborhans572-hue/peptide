import { responsiveImageProps } from './productImages.js'

export default function ResponsiveImage({ src, sizes = '(max-width: 720px) 92vw, 600px', loading = 'lazy', decoding = 'async', ...props }) {
  return <img {...responsiveImageProps(src, sizes)} loading={loading} decoding={decoding} {...props} />
}
