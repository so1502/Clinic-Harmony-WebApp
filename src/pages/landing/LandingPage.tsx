import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  Users, 
  Shield, 
  Clock, 
  CheckCircle2, 
  ChevronRight, 
  Globe,
  LayoutDashboard,
  Menu,
  X
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const LandingPage = () => {
  const { t, i18n } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleLanguage = () => {
    const newLang = i18n.language === 'de' ? 'en' : 'de';
    i18n.changeLanguage(newLang);
  };

  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 }
  };

  const staggerContainer = {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">Clinic Harmony</span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            <button 
              onClick={toggleLanguage}
              className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
            >
              <Globe className="w-4 h-4" />
              {i18n.language.toUpperCase()}
            </button>
            <Link 
              to="/auth/login" 
              className={cn(
                buttonVariants({ variant: 'outline' }), 
                "text-primary border-primary/20 hover:bg-primary/10 hover:border-primary/40 transition-all group"
              )}
            >
              {t('landing.header.login')}
              <ChevronRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link 
              to="/auth/register" 
              className={cn(
                buttonVariants({ variant: 'default' }), 
                "hidden md:inline-flex shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
              )}
            >
              {t('landing.header.register')}
            </Link>
          </nav>

          {/* Mobile Menu Toggle */}
          <button className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Nav */}
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="md:hidden border-t bg-background"
          >
            <div className="container mx-auto px-4 py-4 flex flex-col gap-4">
              <button 
                onClick={toggleLanguage}
                className="flex items-center gap-2 text-sm font-medium"
              >
                <Globe className="w-4 h-4" />
                Language: {i18n.language.toUpperCase()}
              </button>
              <Link to="/auth/login" className="text-sm font-medium py-2">
                {t('landing.header.login')}
              </Link>
              <Link 
                to="/auth/register" 
                className={cn(
                  buttonVariants({ variant: 'default' }), 
                  "w-full justify-center shadow-sm active:scale-95 transition-all"
                )}
              >
                {t('landing.header.register')}
              </Link>
            </div>
          </motion.div>
        )}
      </header>

      <main className="pt-16">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 lg:py-32">
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute left-1/2 top-0 -translate-x-1/2 w-full h-[1000px] bg-[radial-gradient(circle_at_50%_20%,_var(--tw-gradient-stops))] from-blue-100/50 via-blue-50/20 to-transparent opacity-100 blur-3xl" />
            <div className="absolute left-[10%] top-[10%] w-[400px] h-[400px] bg-blue-100/20 rounded-full blur-[100px]" />
            <div className="absolute right-[10%] bottom-[10%] w-[500px] h-[500px] bg-blue-100/20 rounded-full blur-[120px]" />
          </div>
          
          <div className="container mx-auto px-4 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-sm font-medium mb-8"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              {t('landing.hero.platformTag')}
            </motion.div>

            <motion.h1 
              {...fadeInUp}
              className="text-5xl lg:text-7xl font-bold tracking-tight mb-6"
            >
              <span className="text-slate-900">
                {i18n.language === 'de' ? 'Optimieren Sie Ihre' : 'Streamline Your'}
              </span>{' '}
              <span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
                {i18n.language === 'de' ? 'Therapie-Praxis' : 'Therapy Clinic'}
              </span>
            </motion.h1>
            
            <motion.p 
              {...fadeInUp}
              transition={{ delay: 0.1 }}
              className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
            >
              {t('landing.hero.subtitle')}
            </motion.p>

            <motion.div 
              {...fadeInUp}
              transition={{ delay: 0.2 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link 
                to="/auth/register" 
                className={cn(
                  buttonVariants({ variant: 'default', size: 'lg' }), 
                  "h-12 px-8 text-base shadow-lg shadow-primary/20 hover:-translate-y-1 transition-all duration-300 group"
                )}
              >
                {t('landing.hero.getStarted')}
                <ChevronRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Button 
                size="lg" 
                variant="outline" 
                className="h-12 px-8 text-base border-slate-200 bg-white/50 backdrop-blur-sm hover:bg-white hover:border-primary/30 hover:text-primary transition-all duration-300 shadow-sm hover:shadow-md"
              >
                {t('landing.hero.learnMore')}
              </Button>
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">{t('landing.features.title')}</h2>
              <p className="text-muted-foreground">{t('landing.features.subtitle')}</p>
            </div>

            <motion.div 
              variants={staggerContainer}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {[
                { icon: Calendar, title: t('landing.features.smartScheduling.title'), desc: t('landing.features.smartScheduling.description') },
                { icon: Users, title: t('landing.features.patientManagement.title'), desc: t('landing.features.patientManagement.description') },
                { icon: Shield, title: t('landing.features.roleAccess.title'), desc: t('landing.features.roleAccess.description') },
                { icon: Clock, title: t('landing.features.realtime.title'), desc: t('landing.features.realtime.description') },
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  variants={fadeInUp}
                  className="p-8 rounded-2xl border border-slate-100 bg-white/70 backdrop-blur-sm hover:bg-white hover:shadow-xl hover:border-primary/10 hover:-translate-y-1 transition-all duration-500"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform">
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-xl mb-3 text-slate-900">{feature.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    {feature.desc}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-24">
          <div className="container mx-auto px-4">
            <div className="flex flex-col lg:flex-row items-center gap-16">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="flex-1"
              >
                <h2 className="text-4xl font-bold mb-6 leading-tight">
                  {t('landing.benefits.title')}
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  {t('landing.benefits.description')}
                </p>
                <ul className="space-y-4">
                  {[
                    t('landing.benefits.list.doubleBooking'),
                    t('landing.benefits.list.multiClinic'),
                    t('landing.benefits.list.therapistView'),
                    t('landing.benefits.list.resourceMgmt')
                  ].map((benefit, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                      <span className="font-medium">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="flex-1 relative"
              >
                <div className="aspect-video rounded-2xl bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border shadow-2xl flex items-center justify-center relative overflow-hidden group">
                  <div className="absolute inset-0 bg-grid-white/10 group-hover:bg-grid-white/20 transition-all" />
                  <div className="relative z-10 text-center">
                    <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 border border-white/20">
                      <LayoutDashboard className="w-8 h-8" />
                    </div>
                    <span className="font-medium text-sm">Dashboard Preview</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 bg-primary text-primary-foreground overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <h2 className="text-4xl font-bold mb-6">{t('landing.cta.title')}</h2>
            <p className="text-primary-foreground/80 text-lg mb-10 max-w-xl mx-auto">
              {t('landing.cta.subtitle')}
            </p>
            <Link 
              to="/auth/register" 
              className={cn(
                buttonVariants({ variant: 'secondary', size: 'lg' }), 
                "h-12 px-8 text-base shadow-xl hover:shadow-white/10 hover:-translate-y-1 transition-all duration-300"
              )}
            >
              {t('landing.cta.startTrial')}
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-12 border-t">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-primary-foreground">
              <Calendar className="w-4 h-4" />
            </div>
            <span className="font-bold">Clinic Harmony</span>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            {t('landing.footer.copyright')}
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground">Terms</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
