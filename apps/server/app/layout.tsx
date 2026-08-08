import type { Metadata } from "next";
export const metadata:Metadata={title:"HAVOC hosted runner",description:"Secure model runner for the HAVOC public replay lab."};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body style={{margin:0}}>{children}</body></html>}