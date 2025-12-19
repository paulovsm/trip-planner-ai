import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MapPin, Calendar, Sparkles, Upload, ArrowRight, CheckCircle2, Globe2 } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="container px-4 md:px-6 mx-auto relative z-10">
          <div className="flex flex-col items-center text-center space-y-8">
            <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary/10 text-primary hover:bg-primary/20">
              <Sparkles className="w-3 h-3 mr-1" />
              Nova IA de Planejamento
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight lg:text-7xl bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-500 to-blue-600 max-w-4xl">
              Sua próxima aventura, planejada com perfeição.
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Transforme documentos de viagem em roteiros otimizados em segundos. 
              Deixe nossa IA organizar seus dias para você aproveitar cada momento.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
              <Link href="/trips/new">
                <Button size="lg" className="w-full sm:w-auto h-12 px-8 text-lg gap-2">
                  Começar Agora <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="#features">
                <Button variant="outline" size="lg" className="w-full sm:w-auto h-12 px-8 text-lg">
                  Como Funciona
                </Button>
              </Link>
            </div>
          </div>
        </div>
        
        {/* Background decoration */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-10 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full blur-3xl" />
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-muted/50">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">Tudo que você precisa</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Ferramentas poderosas para simplificar o planejamento da sua viagem, do início ao fim.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Upload className="w-10 h-10 text-blue-500" />}
              title="Importação Inteligente"
              description="Arraste seus PDFs e DOCs. Nossa IA extrai automaticamente hotéis, voos e pontos de interesse."
            />
            <FeatureCard 
              icon={<MapPin className="w-10 h-10 text-green-500" />}
              title="Mapa Interativo"
              description="Visualize todos os seus pontos no mapa. Adicione novos locais com um clique e organize sua rota."
            />
            <FeatureCard 
              icon={<Calendar className="w-10 h-10 text-purple-500" />}
              title="Roteiros Otimizados"
              description="Algoritmos avançados calculam a melhor rota para cada dia, economizando tempo de deslocamento."
            />
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Do caos ao plano perfeito em 3 passos
              </h2>
              <div className="space-y-6">
                <Step 
                  number="1"
                  title="Crie sua Viagem"
                  description="Defina o destino e as datas. Importe seus documentos de reserva ou adicione locais manualmente."
                />
                <Step 
                  number="2"
                  title="Organize com IA"
                  description="Nossa inteligência artificial sugere a melhor ordem de visita e agrupa atrações próximas."
                />
                <Step 
                  number="3"
                  title="Explore e Ajuste"
                  description="Visualize seu itinerário dia a dia. Use o chat assistente para pedir dicas de restaurantes e passeios."
                />
              </div>
            </div>
            <div className="relative h-[400px] lg:h-[600px] bg-muted rounded-2xl border shadow-xl overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-950 dark:to-purple-950 opacity-50" />
              <Globe2 className="w-64 h-64 text-muted-foreground/20" />
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-sm text-muted-foreground font-medium bg-background/80 backdrop-blur px-4 py-2 rounded-full border shadow-sm">
                  Preview da Interface
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container px-4 md:px-6 mx-auto text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-6">
            Pronto para sua próxima viagem?
          </h2>
          <p className="text-primary-foreground/80 text-lg max-w-2xl mx-auto mb-8">
            Junte-se a milhares de viajantes que planejam roteiros inteligentes e sem estresse.
          </p>
          <Link href="/trips/new">
            <Button size="lg" variant="secondary" className="h-12 px-8 text-lg">
              Criar Roteiro Grátis
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t">
        <div className="container px-4 md:px-6 mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © 2024 TripPlanner. Todos os direitos reservados.
          </p>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link href="#" className="hover:underline">Termos</Link>
            <Link href="#" className="hover:underline">Privacidade</Link>
            <Link href="#" className="hover:underline">Contato</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="flex flex-col items-center text-center p-6 bg-background rounded-xl border shadow-sm hover:shadow-md transition-shadow">
      <div className="mb-4 p-3 bg-muted rounded-full">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  )
}

function Step({ number, title, description }: { number: string, title: string, description: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
        {number}
      </div>
      <div>
        <h3 className="text-xl font-semibold mb-1">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
