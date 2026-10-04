import React, { useState, useRef, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Compass, Menu, X, Luggage } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location] = useLocation();

  const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMenu = () => setIsMobileMenuOpen(false);

  useEffect(() => {
    closeMenu();
  }, [location]);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-primary selection:text-primary-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center transition-transform group-hover:scale-105">
              <Compass className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-serif text-xl font-semibold tracking-tight text-foreground">
              Aura
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Discover
            </Link>
            <Link href="/itineraries" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              My Journeys
            </Link>
            <Link href="/itinerary/new">
              <Button size="sm" className="font-serif">Plan a Trip</Button>
            </Link>
          </nav>

          <button className="md:hidden p-2 -mr-2 text-foreground" onClick={toggleMenu}>
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-16 left-0 w-full bg-background border-b shadow-lg py-4 px-4 flex flex-col gap-4">
            <Link href="/" className="text-lg font-medium text-foreground py-2 border-b">
              Discover
            </Link>
            <Link href="/itineraries" className="text-lg font-medium text-foreground py-2 border-b">
              My Journeys
            </Link>
            <Link href="/itinerary/new" className="pt-2">
              <Button className="w-full font-serif" size="lg">Plan a Trip</Button>
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>

      <footer className="border-t bg-muted/30 mt-auto py-12">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Compass className="h-5 w-5" />
            <span className="font-serif text-lg font-semibold">Aura</span>
          </div>
          <p className="text-sm text-muted-foreground">
            A luxury travel concierge powered by AI.
          </p>
        </div>
      </footer>
    </div>
  );
}
