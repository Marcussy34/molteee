import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en" className="dark">
      <Head>
        {/* Default title — pages can override with next/head */}
        <title>molteee</title>
        {/* Favicon for browser tab — pixel-art M with flame */}
        <link rel="icon" href="/Moltee_Log.png" type="image/png" />
        <link rel="apple-touch-icon" href="/Moltee_Log.png" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
