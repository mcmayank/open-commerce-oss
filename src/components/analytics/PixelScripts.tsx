import Script from 'next/script'
import type { AnalyticsIds } from '@/lib/analytics'

/**
 * Renders the official base snippet for each configured marketing pixel. Ids are
 * regex-validated on write AND re-validated by `readAnalytics` on read (safe
 * character classes only), so interpolating them into these known snippets can
 * never inject markup. Base pixels fire a page view; e-commerce event forwarding
 * (Purchase/AddToCart) is a follow-up on top of the existing GA4 event plumbing.
 *
 * Each snippet is the vendor's standard loader with only the id substituted.
 *
 * `nonce` is passed through explicitly from AnalyticsScripts (see the comment
 * there): next/script's automatic nonce pickup via HeadManagerContext is a
 * no-op under App Router, so every one of these `<Script>` tags needs it as
 * a prop or the browser drops the inline snippet under a nonce'd script-src.
 */
export function PixelScripts({
  metaPixelId,
  tiktokPixelId,
  pinterestTagId,
  snapchatPixelId,
  googleAdsId,
  clarityProjectId,
  hotjarId,
  nonce,
}: AnalyticsIds & { nonce?: string }) {
  return (
    <>
      {metaPixelId && (
        <>
          <Script id="meta-pixel" strategy="afterInteractive" nonce={nonce}>{`
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${metaPixelId}');fbq('track','PageView');`}</Script>
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              alt=""
              src={`https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      )}

      {tiktokPixelId && (
        <Script id="tiktok-pixel" strategy="afterInteractive" nonce={nonce}>{`
!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
ttq.load('${tiktokPixelId}');ttq.page();}(window,document,'ttq');`}</Script>
      )}

      {pinterestTagId && (
        <>
          <Script id="pinterest-tag" strategy="afterInteractive" nonce={nonce}>{`
!function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var n=window.pintrk;n.queue=[],n.version="3.0";var t=document.createElement("script");t.async=!0,t.src=e;var r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");
pintrk('load','${pinterestTagId}');pintrk('page');`}</Script>
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              alt=""
              src={`https://ct.pinterest.com/v3/?event=init&tid=${pinterestTagId}&noscript=1`}
            />
          </noscript>
        </>
      )}

      {snapchatPixelId && (
        <Script id="snapchat-pixel" strategy="afterInteractive" nonce={nonce}>{`
(function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};a.queue=[];var s='script';var r=t.createElement(s);r.async=!0;r.src=n;var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u)})(window,document,'https://sc-static.net/scevent.min.js');
snaptr('init','${snapchatPixelId}');snaptr('track','PAGE_VIEW');`}</Script>
      )}

      {googleAdsId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${googleAdsId}`}
            strategy="afterInteractive"
            nonce={nonce}
          />
          <Script id="google-ads" strategy="afterInteractive" nonce={nonce}>{`
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());gtag('config','${googleAdsId}');`}</Script>
        </>
      )}

      {clarityProjectId && (
        <Script id="ms-clarity" strategy="afterInteractive" nonce={nonce}>{`
(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarityProjectId}");`}</Script>
      )}

      {hotjarId && (
        <Script id="hotjar" strategy="afterInteractive" nonce={nonce}>{`
(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:${hotjarId},hjsv:6};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;a.appendChild(r);})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`}</Script>
      )}
    </>
  )
}
