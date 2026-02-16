import './style.css'
import { Noto_Sans_Arabic } from "next/font/google"

const notoArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-arabic",
  display: "swap",
});

export const metadata = {
  title: "Offrelli Store",
  description: "Offrelli dashboard for Stores",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar">
      <body id='app-container' className={`${notoArabic.variable}`}>
        {children}
      </body>
    </html>
  );
}