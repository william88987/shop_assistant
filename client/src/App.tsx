import { Switch, Route } from "wouter";
import { useState, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SplashScreen } from "@/components/splash-screen";
import NotFound from "@/pages/not-found";
import MainPage from "@/pages/main";
import CreateListPage from "@/pages/create-list";
import ShoppingListPage from "@/pages/shopping-list";
import AskAIPage from "@/pages/ask-ai";

function Router() {
  return (
    <Switch>
      <Route path="/" component={MainPage} />
      <Route path="/create" component={CreateListPage} />
      <Route path="/list/:id" component={ShoppingListPage} />
      <Route path="/ask-ai" component={AskAIPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    // Check if splash screen has been shown for this version
    const SPLASH_VERSION = 'v2.5'; // Update this when splash content changes
    
    // Clear any old splash screen versions to force fresh display
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('splashScreenShown_') && key !== `splashScreenShown_${SPLASH_VERSION}`) {
        localStorage.removeItem(key);
      }
    });
    
    const splashShown = localStorage.getItem(`splashScreenShown_${SPLASH_VERSION}`);
    if (!splashShown) {
      setShowSplash(true);
    }
  }, []);

  const handleSplashClose = () => {
    setShowSplash(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        {showSplash ? (
          <SplashScreen onClose={handleSplashClose} />
        ) : (
          <Router />
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
