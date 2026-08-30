import './globals.css';

export const metadata={
  title:'OnTop Oferta Lab',
  description:'Transforme serviços e produtos em ofertas profissionais com assistência de IA.',
  icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'},
};

export default function RootLayout({children}){
  return <html lang="pt-BR"><body>{children}</body></html>;
}
