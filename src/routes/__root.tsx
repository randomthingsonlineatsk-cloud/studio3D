import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import '../styles.css'

const GA_MEASUREMENT_ID = 'G-C1SEJSK55F'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Studio3D — Free 3D Massing Tool for Architecture & CAD Students' },
      {
        name: 'description',
        content:
          'A free browser-based 3D massing and visualization sketchpad for architecture and CAD students. Sketch footprints, drop in furniture and site context, measure, and export.',
      },
    ],
    links: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    // Remove this scripts block (or swap the ID) if you fork this project —
    // it points at the original author's Google Analytics property.
    scripts: [
      { src: `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`, async: true },
      {
        children: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');`,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
