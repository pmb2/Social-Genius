export default function Head() {
  return (
    <>
      <link rel="icon" href="/favicon.ico" sizes="any" />
      <link rel="apple-touch-icon" href="/apple-icon.png" />
      {/* Add preconnect for faster image loading */}
      <link rel="preconnect" href="https://hebbkx1anhila5yf.public.blob.vercel-storage.com" />
      <link rel="dns-prefetch" href="https://hebbkx1anhila5yf.public.blob.vercel-storage.com" />
      {/* Preload key fonts */}
      <link rel="preload" href="/fonts/GeistVF.woff" as="font" type="font/woff" crossOrigin="anonymous" />
    </>
  )
}