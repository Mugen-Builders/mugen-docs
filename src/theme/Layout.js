import React from 'react';
import Layout from '@theme-original/Layout';

const GoogleTagManagerNoscript = () => (
  <noscript>
    <iframe
      src="https://www.googletagmanager.com/ns.html?id=GTM-NGX36B79"
      height="0"
      width="0"
      style={{ display: 'none', visibility: 'hidden' }}
    ></iframe>
  </noscript>
);

export default function CustomLayout(props) {
  return (
    <>
      <GoogleTagManagerNoscript />
      <Layout {...props} />
    </>
  );
}
