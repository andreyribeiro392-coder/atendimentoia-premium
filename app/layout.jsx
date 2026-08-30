import './globals.css';

export const metadata={
  title:'OnTop E-book Studio Premium',
  description:'Crie e-books e produtos digitais profissionais com assistência de IA.',
  icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'},
};

export default function RootLayout({children}){
  return <html lang="pt-BR"><body>{children}</body></html>;
}
