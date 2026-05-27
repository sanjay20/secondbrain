import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-950/30 via-background to-indigo-950/20" />
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl" />

      <div className="relative z-10 flex flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold gradient-text mb-2">SecondBrain</h1>
          <p className="text-muted-foreground text-sm">Your AI-powered life operating system</p>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: "shadow-none",
              card: "bg-card border border-border shadow-2xl",
              headerTitle: "text-foreground",
              headerSubtitle: "text-muted-foreground",
              socialButtonsBlockButton: "bg-secondary border-border text-foreground hover:bg-secondary/80",
              formFieldInput: "bg-secondary border-border text-foreground",
              formButtonPrimary: "bg-primary hover:bg-primary/90",
              footerActionLink: "text-primary",
            },
          }}
        />
      </div>
    </div>
  );
}
