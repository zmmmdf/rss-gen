import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Terminal, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Auth() {
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();
    const location = useLocation();

    const from = location.state?.from?.pathname || '/';

    const handleAuth = async (action: 'login' | 'signup', e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (action === 'signup') {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                toast.success('Check your email for the confirmation link');
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                navigate(from, { replace: true });
            }
        } catch (error: any) {
            toast.error(error.message || 'An error occurred during authentication');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
            <div className="w-full max-w-md space-y-8">
                <div className="flex flex-col items-center space-y-2 text-center mb-8">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                        <Terminal className="h-6 w-6 text-primary" />
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">rss-gen</h1>
                    <p className="text-sm text-muted-foreground">
                        Custom RSS feeds from any website
                    </p>
                </div>

                <Tabs defaultValue="login" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="login">Login</TabsTrigger>
                        <TabsTrigger value="signup">Sign Up</TabsTrigger>
                    </TabsList>

                    <TabsContent value="login">
                        <Card className="border-border">
                            <CardHeader>
                                <CardTitle>Welcome back</CardTitle>
                                <CardDescription>
                                    Enter your credentials to access your feeds
                                </CardDescription>
                            </CardHeader>
                            <form onSubmit={(e) => handleAuth('login', e)}>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="email-login">Email</Label>
                                        <Input
                                            id="email-login"
                                            type="email"
                                            placeholder="m@example.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="password-login">Password</Label>
                                        <Input
                                            id="password-login"
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button className="w-full font-mono glow-orange" type="submit" disabled={isLoading}>
                                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Sign In
                                    </Button>
                                </CardFooter>
                            </form>
                        </Card>
                    </TabsContent>

                    <TabsContent value="signup">
                        <Card className="border-border">
                            <CardHeader>
                                <CardTitle>Create an account</CardTitle>
                                <CardDescription>
                                    Start generating custom RSS feeds today
                                </CardDescription>
                            </CardHeader>
                            <form onSubmit={(e) => handleAuth('signup', e)}>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="email-signup">Email</Label>
                                        <Input
                                            id="email-signup"
                                            type="email"
                                            placeholder="m@example.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="password-signup">Password</Label>
                                        <Input
                                            id="password-signup"
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            minLength={6}
                                        />
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button className="w-full font-mono glow-orange" type="submit" disabled={isLoading}>
                                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Sign Up
                                    </Button>
                                </CardFooter>
                            </form>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
