import { useLocation } from 'react-router'
import { initialRouteHtml } from './seoInitialState.js'

export default function RouteFallback() {
  const { pathname } = useLocation()
  const html = initialRouteHtml(pathname)
  return html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <div className="route-loader" role="status">Loading page…</div>
}
