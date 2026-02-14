import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en" className="dark">
      <Head>
        {/* Default title — pages can override with next/head */}
        <title>molteee</title>
        {/* Favicon for browser tab — pixel-art M with flame */}
        <link rel="icon" type="image/png" sizes="32x32" href="/Moltee_Log.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/Moltee_Log.png" />
        <link rel="shortcut icon" href="/Moltee_Log.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/Moltee_Log.png" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
